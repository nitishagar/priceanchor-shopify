// Shared products/create|update|delete webhook handling for price capture.
// - create/update: diff payload variant prices vs latest snapshots, record a
//   row per changed variant, refresh the per-market metafields with the new
//   EU 30-day prior price + US 90-day former price, and auto-clear stale
//   compare-at anchors when the shop enabled it (Unlimited plan).
// - delete: snapshots are retained as Omnibus evidence (the price history is
//   the audit trail); only the tracked-product counter is reconciled.

import { and, eq } from "drizzle-orm";
import type { DbClient } from "../db.server";
import { priceSnapshots, shops } from "../db/schema";
import { getOrCreateShop } from "./shop.server";
import {
  diffVariantPrices,
  distinctProductCount,
  recordSnapshot,
  snapshotsForVariant,
  type WebhookVariantPrice,
} from "./price-history.server";
import {
  caFormerPriceHeuristic,
  compareAtSince,
  euPriorPrice,
  lastObservedAt,
} from "./lowest-price.server";
import {
  writeFormerPriceMetafield,
  writeLowestPriceMetafield,
} from "./metafields.server";
import {
  checkPlanAllowsProduct,
  getPlanCapabilities,
  type Plan,
} from "./plan-enforcer.server";
import { parseGuardSettings } from "../lib/guard-settings";
import { MS_PER_DAY } from "../lib/pricing";
import { classifyStale, clearCompareAtPrice } from "./stale-guard.server";
import type { AdminGraphQLClient } from "./graphql-types.server";

export interface ProductWebhookPayload {
  id: number | string;
  title?: string;
  handle?: string;
  status?: string;
  currency?: string;
  variants?: Array<{
    id: number | string;
    price: unknown;
    compare_at_price?: unknown;
  }>;
}

export interface PriceCaptureResult {
  recorded: number;
  skippedUnchanged: number;
  metafieldsWritten: number;
  metafieldErrors: string[];
  productKnown: boolean;
  autoCleared: number;
  autoClearErrors: string[];
}

async function reconcileTrackedCount(shopId: number, dbClient: DbClient) {
  const count = await distinctProductCount(shopId, dbClient);
  await dbClient
    .update(shops)
    .set({ trackedCount: count })
    .where(eq(shops.id, shopId));
}

export async function handleProductPriceCapture(
  shopDomain: string,
  admin: AdminGraphQLClient | null,
  payload: ProductWebhookPayload,
  dbClient: DbClient,
  source: "webhook" | "snapshot" | "backfill" = "webhook",
): Promise<PriceCaptureResult> {
  const result: PriceCaptureResult = {
    recorded: 0,
    skippedUnchanged: 0,
    metafieldsWritten: 0,
    metafieldErrors: [],
    productKnown: false,
    autoCleared: 0,
    autoClearErrors: [],
  };

  const shopRecord = await getOrCreateShop(shopDomain, dbClient);
  if (!shopRecord) return result;

  const productId = String(payload.id);
  const variants: WebhookVariantPrice[] = (payload.variants ?? []).map((v) => ({
    id: v.id,
    price: v.price,
    compare_at_price: v.compare_at_price,
  }));
  if (variants.length === 0) return result;

  // Plan gate: a brand-new product on an over-limit shop is not tracked.
  const existingProduct = await dbClient.query.priceSnapshots.findFirst({
    where: and(
      eq(priceSnapshots.shopId, shopRecord.id),
      eq(priceSnapshots.productId, productId),
    ),
  });
  result.productKnown = existingProduct != null;
  if (!result.productKnown) {
    const check = await checkPlanAllowsProduct(shopRecord.id, dbClient, 1);
    if (!check.allowed) return result;
  }

  const market = "default";
  const currency =
    typeof payload.currency === "string" && payload.currency
      ? payload.currency
      : "USD";

  const diffs = await diffVariantPrices(
    shopRecord.id,
    productId,
    variants,
    dbClient,
    market,
  );

  for (const d of diffs) {
    if (!d.changed) {
      result.skippedUnchanged += 1;
      continue;
    }
    await recordSnapshot(
      {
        shopId: shopRecord.id,
        productId,
        variantId: d.variantId,
        market,
        currency,
        priceMinor: d.priceMinor,
        compareAtMinor: d.compareAtMinor,
        source,
      },
      dbClient,
    );
    result.recorded += 1;

    if (admin) {
      const history = await snapshotsForVariant(
        shopRecord.id,
        productId,
        d.variantId,
        dbClient,
        market,
        500,
      );
      const ownerId = `gid://shopify/Product/${productId}`;
      const prior = euPriorPrice(history);
      if (prior.lowestMinor !== null) {
        try {
          const write = await writeLowestPriceMetafield(admin, ownerId, market, {
            lowestMinor: prior.lowestMinor,
            currency,
            capturedAt: new Date().toISOString(),
            windowDays: prior.windowDays,
            currentMinor: d.priceMinor,
          });
          if (write.ok) result.metafieldsWritten += 1;
          else if (write.error) result.metafieldErrors.push(write.error);
        } catch (err) {
          result.metafieldErrors.push(
            err instanceof Error ? err.message : String(err),
          );
        }
      }
      const former = caFormerPriceHeuristic(history);
      if (former.lowestMinor !== null) {
        try {
          const lastOffered = lastObservedAt(history, former.lowestMinor);
          const write = await writeFormerPriceMetafield(admin, ownerId, market, {
            lowestMinor: former.lowestMinor,
            currency,
            lastOfferedAt: lastOffered ? lastOffered.toISOString() : null,
            windowDays: former.windowDays,
            currentMinor: d.priceMinor,
          });
          if (write.ok) result.metafieldsWritten += 1;
          else if (write.error) result.metafieldErrors.push(write.error);
        } catch (err) {
          result.metafieldErrors.push(
            err instanceof Error ? err.message : String(err),
          );
        }
      }
      await maybeAutoClearCompareAt(
        admin,
        shopRecord,
        productId,
        d.variantId,
        d.compareAtMinor,
        history,
        result,
      );
    }
  }

  if (result.recorded > 0) {
    await reconcileTrackedCount(shopRecord.id, dbClient);
  }
  return result;
}

// Auto-clear a compare-at anchor that reached the shop's "stale" tier when
// the merchant enabled auto-clear (Unlimited plan only). Failures are
// collected, never thrown: price capture must not fail over a guard write.
async function maybeAutoClearCompareAt(
  admin: AdminGraphQLClient,
  shopRecord: { plan: string | null; settings: unknown },
  productId: string,
  variantId: string,
  compareAtMinor: number | null,
  history: { priceMinor: number; capturedAt: Date; compareAtMinor?: number | null }[],
  result: PriceCaptureResult,
  asOf: Date = new Date(),
): Promise<void> {
  const settings = parseGuardSettings(shopRecord.settings);
  if (!settings.autoClear) return;
  const capabilities = getPlanCapabilities((shopRecord.plan as Plan) ?? "free");
  if (!capabilities.autoClear) return;
  if (compareAtMinor === null) return;
  const since = compareAtSince(history, compareAtMinor);
  const ageDays =
    since === null
      ? null
      : Math.floor((asOf.getTime() - since.getTime()) / MS_PER_DAY);
  const status = classifyStale(ageDays, compareAtMinor, settings);
  if (status !== "stale") return;
  try {
    const cleared = await clearCompareAtPrice(
      admin,
      `gid://shopify/ProductVariant/${variantId}`,
    );
    if (cleared.ok) result.autoCleared += 1;
    else if (cleared.error) result.autoClearErrors.push(cleared.error);
  } catch (err) {
    result.autoClearErrors.push(err instanceof Error ? err.message : String(err));
  }
  void productId;
}

export async function handleProductDelete(
  shopDomain: string,
  productId: string | number,
  dbClient: DbClient,
): Promise<{ reconciled: boolean }> {
  // History is retained as evidence; just reconcile the tracked counter
  // against remaining products.
  const shopRecord = await getOrCreateShop(shopDomain, dbClient);
  if (!shopRecord) return { reconciled: false };
  void productId;
  await reconcileTrackedCount(shopRecord.id, dbClient);
  return { reconciled: true };
}

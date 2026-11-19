// Price-history store: append-only snapshots + webhook payload diffing.
//
// products/update fires on ANY product edit (title, tags, inventory), not
// price-only, so every handler must diff payload prices against the latest
// stored snapshot and record a row only when a price actually changed.

import { and, desc, eq } from "drizzle-orm";
import type { DbClient } from "../db.server";
import { priceSnapshots, type NewPriceSnapshot } from "../db/schema";
import { parsePriceToMinor, type PricePoint } from "./lowest-price.server";

export interface WebhookVariantPrice {
  id: number | string;
  price: unknown;
  compare_at_price?: unknown;
}

export interface VariantPriceChange {
  variantId: string;
  priceMinor: number;
  compareAtMinor: number | null;
  previousPriceMinor: number | null;
  previousCompareAtMinor: number | null;
  changed: boolean;
}

export async function latestSnapshotForVariant(
  shopId: number,
  productId: string,
  variantId: string,
  dbClient: DbClient,
  market = "default",
): Promise<PricePoint & { compareAtMinor: number | null } | null> {
  const row = await dbClient.query.priceSnapshots.findFirst({
    where: and(
      eq(priceSnapshots.shopId, shopId),
      eq(priceSnapshots.productId, productId),
      eq(priceSnapshots.variantId, variantId),
      eq(priceSnapshots.market, market),
    ),
    orderBy: [desc(priceSnapshots.capturedAt), desc(priceSnapshots.id)],
  });
  if (!row) return null;
  return {
    priceMinor: row.priceMinor,
    compareAtMinor: row.compareAtMinor,
    capturedAt: row.capturedAt,
    market: row.market,
    currency: row.currency,
  };
}

// Diff webhook variant prices against the latest stored snapshot per variant.
// Variants whose price AND compare-at are unchanged (or unparseable) are
// reported with changed=false so the caller can skip them.
export async function diffVariantPrices(
  shopId: number,
  productId: string,
  variants: WebhookVariantPrice[],
  dbClient: DbClient,
  market = "default",
): Promise<VariantPriceChange[]> {
  const out: VariantPriceChange[] = [];
  for (const v of variants) {
    const variantId = String(v.id);
    const priceMinor = parsePriceToMinor(v.price);
    if (priceMinor === null) continue;
    const compareAtMinor =
      v.compare_at_price === null ||
      v.compare_at_price === undefined ||
      v.compare_at_price === ""
        ? null
        : parsePriceToMinor(v.compare_at_price);
    const prev = await latestSnapshotForVariant(
      shopId,
      productId,
      variantId,
      dbClient,
      market,
    );
    const changed =
      prev === null ||
      prev.priceMinor !== priceMinor ||
      (prev.compareAtMinor ?? null) !== (compareAtMinor ?? null);
    out.push({
      variantId,
      priceMinor,
      compareAtMinor,
      previousPriceMinor: prev?.priceMinor ?? null,
      previousCompareAtMinor: prev?.compareAtMinor ?? null,
      changed,
    });
  }
  return out;
}

export interface RecordSnapshotInput {
  shopId: number;
  productId: string;
  variantId: string;
  market?: string;
  currency?: string;
  priceMinor: number;
  compareAtMinor?: number | null;
  source?: string;
  capturedAt?: Date;
}

export async function recordSnapshot(
  input: RecordSnapshotInput,
  dbClient: DbClient,
) {
  const row: NewPriceSnapshot = {
    shopId: input.shopId,
    productId: input.productId,
    variantId: input.variantId,
    market: input.market ?? "default",
    currency: input.currency ?? "USD",
    priceMinor: input.priceMinor,
    compareAtMinor: input.compareAtMinor ?? null,
    source: input.source ?? "webhook",
    capturedAt: input.capturedAt ?? new Date(),
  };
  const [inserted] = await dbClient.insert(priceSnapshots).values(row).returning();
  return inserted;
}

export async function snapshotsForVariant(
  shopId: number,
  productId: string,
  variantId: string,
  dbClient: DbClient,
  market = "default",
  limit = 500,
): Promise<PricePoint[]> {
  const rows = await dbClient.query.priceSnapshots.findMany({
    where: and(
      eq(priceSnapshots.shopId, shopId),
      eq(priceSnapshots.productId, productId),
      eq(priceSnapshots.variantId, variantId),
      eq(priceSnapshots.market, market),
    ),
    orderBy: [desc(priceSnapshots.capturedAt)],
    limit,
  });
  return rows.map((r) => ({
    priceMinor: r.priceMinor,
    capturedAt: r.capturedAt,
    market: r.market,
    currency: r.currency,
    compareAtMinor: r.compareAtMinor,
  }));
}

// Distinct product count derived from history (used to reconcile
// shops.trackedCount). Counts products, not variants.
export async function distinctProductCount(
  shopId: number,
  dbClient: DbClient,
): Promise<number> {
  const rows = await dbClient
    .selectDistinct({ productId: priceSnapshots.productId })
    .from(priceSnapshots)
    .where(eq(priceSnapshots.shopId, shopId));
  return rows.length;
}

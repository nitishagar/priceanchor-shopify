// Daily snapshot backup: re-captures catalog prices for every installed shop
// so missed webhooks (retries, downtime) never leave gaps in the 30/90-day
// evidence chain. Triggered by POST /api/snapshot (Bearer CRON_SECRET),
// scheduled daily at 14:00 UTC via .github/workflows/snapshot.yml.
//
// Reads use each shop's stored offline session through
// `unauthenticated.admin(shop)`; writes reuse handleProductPriceCapture with
// source "snapshot" (unchanged prices are skipped by diffing, so a snapshot
// run is a no-op for quiet catalogs).

import { db, type DbClient } from "../db.server";
import {
  handleProductPriceCapture,
  type ProductWebhookPayload,
} from "./price-webhook.server";
import type { AdminGraphQLClient } from "./graphql-types.server";

export const SNAPSHOT_PAGE_SIZE = 50;
export const SNAPSHOT_MAX_PAGES = 10;

const PRODUCTS_QUERY = `#graphql
  query PriceAnchorSnapshot($first: Int!, $after: String) {
    products(first: $first, after: $after, query: "status:active") {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        variants(first: 100) {
          nodes {
            id
            price
            compareAtPrice
          }
        }
      }
    }
  }
`;

interface SnapshotProductsResponse {
  data?: {
    products?: {
      pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
      nodes?: Array<{
        id?: string;
        title?: string;
        variants?: {
          nodes?: Array<{
            id?: string;
            price?: unknown;
            compareAtPrice?: unknown;
          }>;
        };
      }>;
    };
  };
}

// gid://shopify/Product/123 -> "123" (falls back to the raw id).
export function numericId(gid: string | undefined): string {
  if (!gid) return "";
  const parts = gid.split("/");
  return parts[parts.length - 1] || gid;
}

export interface SnapshotShopResult {
  shop: string;
  productsSeen: number;
  recorded: number;
  skippedUnchanged: number;
  metafieldsWritten: number;
  autoCleared: number;
  errors: string[];
}

export type CaptureFn = typeof handleProductPriceCapture;

export async function snapshotShop(
  shopDomain: string,
  admin: AdminGraphQLClient,
  dbClient: DbClient = db,
  capture: CaptureFn = handleProductPriceCapture,
): Promise<SnapshotShopResult> {
  const result: SnapshotShopResult = {
    shop: shopDomain,
    productsSeen: 0,
    recorded: 0,
    skippedUnchanged: 0,
    metafieldsWritten: 0,
    autoCleared: 0,
    errors: [],
  };

  let cursor: string | null = null;
  for (let page = 0; page < SNAPSHOT_MAX_PAGES; page += 1) {
    let json: SnapshotProductsResponse;
    try {
      const response = await admin.graphql(PRODUCTS_QUERY, {
        variables: { first: SNAPSHOT_PAGE_SIZE, after: cursor },
      });
      json = (await response.json()) as SnapshotProductsResponse;
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
      return result;
    }
    const connection = json.data?.products;
    const nodes = connection?.nodes ?? [];
    for (const node of nodes) {
      const payload: ProductWebhookPayload = {
        id: numericId(node.id),
        title: node.title,
        variants: (node.variants?.nodes ?? []).map((v) => ({
          id: numericId(v.id),
          price: v.price,
          compare_at_price: v.compareAtPrice,
        })),
      };
      result.productsSeen += 1;
      try {
        const captureResult = await capture(
          shopDomain,
          admin,
          payload,
          "snapshot",
          dbClient,
        );
        result.recorded += captureResult.recorded;
        result.skippedUnchanged += captureResult.skippedUnchanged;
        result.metafieldsWritten += captureResult.metafieldsWritten;
        result.autoCleared += captureResult.autoCleared;
        result.errors.push(
          ...captureResult.metafieldErrors,
          ...captureResult.autoClearErrors,
        );
      } catch (err) {
        result.errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    if (!connection?.pageInfo?.hasNextPage) break;
    cursor = connection.pageInfo.endCursor ?? null;
    if (!cursor) break;
  }
  return result;
}

export interface SnapshotRunResult {
  shops: number;
  productsSeen: number;
  recorded: number;
  results: SnapshotShopResult[];
}

export type GetAdminFn = (shop: string) => Promise<AdminGraphQLClient | null>;

export async function runSnapshotForAllShops(
  getAdmin: GetAdminFn,
  dbClient: DbClient = db,
  capture: CaptureFn = handleProductPriceCapture,
): Promise<SnapshotRunResult> {
  const run: SnapshotRunResult = {
    shops: 0,
    productsSeen: 0,
    recorded: 0,
    results: [],
  };
  const allShops = await dbClient.query.shops.findMany({
    columns: { domain: true },
  });
  for (const shop of allShops) {
    run.shops += 1;
    let admin: AdminGraphQLClient | null = null;
    try {
      admin = await getAdmin(shop.domain);
    } catch (err) {
      run.results.push({
        shop: shop.domain,
        productsSeen: 0,
        recorded: 0,
        skippedUnchanged: 0,
        metafieldsWritten: 0,
        autoCleared: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      });
      continue;
    }
    if (!admin) {
      run.results.push({
        shop: shop.domain,
        productsSeen: 0,
        recorded: 0,
        skippedUnchanged: 0,
        metafieldsWritten: 0,
        autoCleared: 0,
        errors: ["no offline session"],
      });
      continue;
    }
    const shopResult = await snapshotShop(shop.domain, admin, dbClient, capture);
    run.productsSeen += shopResult.productsSeen;
    run.recorded += shopResult.recorded;
    run.results.push(shopResult);
  }
  return run;
}

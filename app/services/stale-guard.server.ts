// Stale-sale guard: flags compare_at_price anchors older than 60/75/90 days.
//
// Background: compare_at_price is a merchant-set free-text marketing field
// with no native auto-expiry and no link to the Art 6a prior price, so an
// old compare-at keeps a "sale" label indefinitely. Thresholds (warn 60d,
// review 75d, stale 90d) are product requirements — configurable per shop —
// not statutory day counts; no statute was found prescribing 60/75/90.
// Auto-clear writes ProductVariant.compareAtPrice=null via the Admin GraphQL
// API (REST has no sale-expiry either).

import type { AdminGraphQLClient } from "./graphql-types.server";
import {
  classifyStale,
  DEFAULT_STALE_THRESHOLDS,
  type StaleStatus,
  type StaleThresholds,
} from "../lib/pricing";

export { classifyStale, DEFAULT_STALE_THRESHOLDS, type StaleStatus, type StaleThresholds };

export interface CompareAtInfo {
  productId: string;
  variantId: string;
  compareAtMinor: number | null;
  // When this compare-at value was first observed (oldest unchanged snapshot).
  compareAtSince: Date | null;
}

export interface StaleFinding extends CompareAtInfo {
  status: StaleStatus;
  ageDays: number | null;
}

export function findStaleSales(
  infos: CompareAtInfo[],
  asOf: Date = new Date(),
  thresholds: StaleThresholds = DEFAULT_STALE_THRESHOLDS,
): StaleFinding[] {
  return infos.map((info) => {
    const ageDays =
      info.compareAtMinor === null || info.compareAtSince === null
        ? null
        : Math.floor(
            (asOf.getTime() - info.compareAtSince.getTime()) /
              (24 * 60 * 60 * 1000),
          );
    return {
      ...info,
      ageDays,
      status: classifyStale(ageDays, info.compareAtMinor, thresholds),
    };
  });
}

const PRODUCT_VARIANT_UPDATE_MUTATION = `#graphql
  mutation PriceAnchorClearCompareAt($input: ProductVariantInput!) {
    productVariantUpdate(input: $input) {
      productVariant {
        id
        compareAtPrice
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface VariantUpdateResponse {
  data?: {
    productVariantUpdate?: {
      productVariant?: { id: string; compareAtPrice: string | null } | null;
      userErrors?: { field: string[] | null; message: string }[];
    };
  };
}

export interface ClearCompareAtResult {
  ok: boolean;
  variantGid: string;
  error?: string;
}

// Clear a stale compare-at anchor via Admin GraphQL. variantGid is the
// variant GID (gid://shopify/ProductVariant/123).
export async function clearCompareAtPrice(
  admin: AdminGraphQLClient,
  variantGid: string,
): Promise<ClearCompareAtResult> {
  const response = await admin.graphql(PRODUCT_VARIANT_UPDATE_MUTATION, {
    variables: { input: { id: variantGid, compareAtPrice: null } },
  });
  const json = (await response.json()) as VariantUpdateResponse;
  const errors = json.data?.productVariantUpdate?.userErrors ?? [];
  if (errors.length > 0) {
    return {
      ok: false,
      variantGid,
      error: errors.map((e) => e.message).join("; "),
    };
  }
  return { ok: true, variantGid };
}

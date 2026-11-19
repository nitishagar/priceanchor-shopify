// App-owned per-market prior/lowest-price metafields.
//
// The storefront Liquid block reads these via shop/product metafields, so
// writes use app-owned ($app namespace) definitions with
// access.storefront = PUBLIC_READ (GraphQL access:{storefront:PUBLIC_READ}).
// Key scheme: one metafield per market, keyed by the market key plus the
// shopper's country (localization.country.iso_code, ISO 3166-1 alpha-2) at
// render time. Value is a JSON string: {"lowestMinor":1299,"currency":"EUR",
// "capturedAt":"...","windowDays":30}.

import type { AdminGraphQLClient } from "./graphql-types.server";

export const METAFIELD_NAMESPACE = "$app:priceanchor";
export const METAFIELD_KEY_PREFIX = "lowest_price";
export const FORMER_PRICE_KEY_PREFIX = "former_price";

export interface MarketLowestPrice {
  lowestMinor: number;
  currency: string;
  capturedAt: string;
  windowDays: number;
  percentOff?: number | null;
  currentMinor?: number;
}

// Market key -> metafield key. Normalized to lowercase alphanumerics so
// market handles ("primär-markt") always produce valid keys.
export function metafieldKeyForMarket(market: string): string {
  return `${METAFIELD_KEY_PREFIX}_${slugifyMarket(market)}`;
}

export function formerPriceKeyForMarket(market: string): string {
  return `${FORMER_PRICE_KEY_PREFIX}_${slugifyMarket(market)}`;
}

function slugifyMarket(market: string): string {
  const slug = market
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return slug || "default";
}

// US (CA B&P 17501) former-price payload: 90-day lowest of the merchant's
// own history plus the date it was last offered, so the storefront can
// render "Previously $X — last offered <Mon YYYY>" (the statute's
// date-disclosure exception makes the framing safe).
export interface MarketFormerPrice {
  lowestMinor: number;
  currency: string;
  // ISO date when the former price was last observed (may be null when the
  // history cannot date it).
  lastOfferedAt: string | null;
  windowDays: number;
  currentMinor?: number;
}

export function encodeFormerPrice(value: MarketFormerPrice): string {
  return JSON.stringify(value);
}

export function decodeFormerPrice(
  raw: string | null | undefined,
): MarketFormerPrice | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MarketFormerPrice;
    if (typeof parsed.lowestMinor !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function encodeLowestPrice(value: MarketLowestPrice): string {
  return JSON.stringify(value);
}

export function decodeLowestPrice(raw: string | null | undefined): MarketLowestPrice | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MarketLowestPrice;
    if (typeof parsed.lowestMinor !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

const METAFIELDS_SET_MUTATION = `#graphql
  mutation PriceAnchorMetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        namespace
        key
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface MetafieldsSetResponse {
  data?: {
    metafieldsSet?: {
      metafields?: { namespace: string; key: string }[];
      userErrors?: { field: string[] | null; message: string }[];
    };
  };
}

export interface MetafieldWriteResult {
  ok: boolean;
  key: string;
  error?: string;
}

// Write (or overwrite) the per-market lowest-price metafield on a product.
// ownerId is the product GID (gid://shopify/Product/123).
export async function writeLowestPriceMetafield(
  admin: AdminGraphQLClient,
  ownerId: string,
  market: string,
  value: MarketLowestPrice,
): Promise<MetafieldWriteResult> {
  return writeJsonMetafield(
    admin,
    ownerId,
    metafieldKeyForMarket(market),
    encodeLowestPrice(value),
  );
}

// Write (or overwrite) the per-market US former-price metafield.
// Same owner/access contract as the EU lowest-price metafield.
export async function writeFormerPriceMetafield(
  admin: AdminGraphQLClient,
  ownerId: string,
  market: string,
  value: MarketFormerPrice,
): Promise<MetafieldWriteResult> {
  return writeJsonMetafield(
    admin,
    ownerId,
    formerPriceKeyForMarket(market),
    encodeFormerPrice(value),
  );
}

async function writeJsonMetafield(
  admin: AdminGraphQLClient,
  ownerId: string,
  key: string,
  value: string,
): Promise<MetafieldWriteResult> {
  const response = await admin.graphql(METAFIELDS_SET_MUTATION, {
    variables: {
      metafields: [
        {
          namespace: METAFIELD_NAMESPACE,
          key,
          type: "json",
          value,
          ownerId,
          access: { storefront: "PUBLIC_READ" },
        },
      ],
    },
  });
  const json = (await response.json()) as MetafieldsSetResponse;
  const errors = json.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length > 0) {
    return { ok: false, key, error: errors.map((e) => e.message).join("; ") };
  }
  return { ok: true, key };
}

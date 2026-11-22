import { describe, it, expect, vi } from "vitest";
import {
  decodeFormerPrice,
  decodeLowestPrice,
  encodeFormerPrice,
  encodeLowestPrice,
  formerPriceKeyForMarket,
  METAFIELD_NAMESPACE,
  metafieldKeyForMarket,
  writeFormerPriceMetafield,
  writeLowestPriceMetafield,
} from "../services/metafields.server";

describe("metafieldKeyForMarket", () => {
  it("prefixes normalized market keys", () => {
    expect(metafieldKeyForMarket("default")).toBe("lowest_price_default");
    expect(metafieldKeyForMarket("DE")).toBe("lowest_price_de");
  });

  it("sanitizes handles to valid keys", () => {
    expect(metafieldKeyForMarket("Primär-Markt")).toBe("lowest_price_prim_r_markt");
    expect(metafieldKeyForMarket("!!!")).toBe("lowest_price_default");
  });
});

describe("formerPriceKeyForMarket", () => {
  it("prefixes normalized market keys with former_price", () => {
    expect(formerPriceKeyForMarket("default")).toBe("former_price_default");
    expect(formerPriceKeyForMarket("US")).toBe("former_price_us");
    expect(formerPriceKeyForMarket("!!!")).toBe("former_price_default");
  });
});

describe("encode/decodeLowestPrice", () => {
  it("round-trips the JSON payload", () => {
    const value = {
      lowestMinor: 1299,
      currency: "EUR",
      capturedAt: "2026-11-19T10:00:00.000Z",
      windowDays: 30,
      currentMinor: 1499,
    };
    expect(decodeLowestPrice(encodeLowestPrice(value))).toEqual(value);
  });

  it("returns null for blank or corrupt payloads", () => {
    expect(decodeLowestPrice(null)).toBeNull();
    expect(decodeLowestPrice("")).toBeNull();
    expect(decodeLowestPrice("{nope")).toBeNull();
    expect(decodeLowestPrice('{"currency":"EUR"}')).toBeNull();
  });
});

describe("writeLowestPriceMetafield", () => {
  const value = {
    lowestMinor: 1299,
    currency: "EUR",
    capturedAt: "2026-11-19T10:00:00.000Z",
    windowDays: 30,
  };

  it("writes a plain-namespace JSON set with no access field", async () => {
    const graphql = vi.fn().mockResolvedValue({
      json: async () => ({
        data: {
          metafieldsSet: {
            metafields: [{ namespace: METAFIELD_NAMESPACE }],
            userErrors: [],
          },
        },
      }),
    });

    const result = await writeLowestPriceMetafield(
      { graphql },
      "gid://shopify/Product/123",
      "DE",
      value,
    );

    expect(result).toEqual({ ok: true, key: "lowest_price_de" });
    expect(graphql).toHaveBeenCalledTimes(1);
    const variables = graphql.mock.calls[0][1].variables;
    expect(variables.metafields[0]).toMatchObject({
      namespace: "priceanchor",
      key: "lowest_price_de",
      type: "json",
      ownerId: "gid://shopify/Product/123",
    });
    // MetafieldsSetInput rejects `access` (passing it failed every write
    // in production); the DualUnit-proven plain set carries none.
    expect(variables.metafields[0]).not.toHaveProperty("access");
    expect(JSON.parse(variables.metafields[0].value)).toEqual(value);
  });

  it("surfaces userErrors", async () => {
    const graphql = vi.fn().mockResolvedValue({
      json: async () => ({
        data: {
          metafieldsSet: {
            metafields: [],
            userErrors: [{ field: ["ownerId"], message: "not found" }],
          },
        },
      }),
    });

    const result = await writeLowestPriceMetafield(
      { graphql },
      "gid://shopify/Product/123",
      "DE",
      value,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
  });
});

describe("encode/decodeFormerPrice", () => {
  it("round-trips the JSON payload with the last-offered date", () => {
    const value = {
      lowestMinor: 9800,
      currency: "USD",
      lastOfferedAt: "2026-10-04T10:00:00.000Z",
      windowDays: 90,
      currentMinor: 7900,
    };
    expect(decodeFormerPrice(encodeFormerPrice(value))).toEqual(value);
  });

  it("returns null for blank or corrupt payloads", () => {
    expect(decodeFormerPrice(null)).toBeNull();
    expect(decodeFormerPrice("")).toBeNull();
    expect(decodeFormerPrice("{nope")).toBeNull();
    expect(decodeFormerPrice('{"currency":"USD"}')).toBeNull();
  });
});

describe("writeFormerPriceMetafield", () => {
  it("writes the former_price key as a plain set", async () => {
    const graphql = vi.fn().mockResolvedValue({
      json: async () => ({
        data: {
          metafieldsSet: {
            metafields: [{ namespace: METAFIELD_NAMESPACE }],
            userErrors: [],
          },
        },
      }),
    });

    const result = await writeFormerPriceMetafield(
      { graphql },
      "gid://shopify/Product/123",
      "US",
      {
        lowestMinor: 9800,
        currency: "USD",
        lastOfferedAt: "2026-10-04T10:00:00.000Z",
        windowDays: 90,
      },
    );

    expect(result).toEqual({ ok: true, key: "former_price_us" });
    expect(graphql).toHaveBeenCalledTimes(1);
    const setVariables = graphql.mock.calls[0][1].variables;
    expect(setVariables.metafields[0]).toMatchObject({
      namespace: "priceanchor",
      key: "former_price_us",
      type: "json",
      ownerId: "gid://shopify/Product/123",
    });
    expect(setVariables.metafields[0]).not.toHaveProperty("access");
  });
});

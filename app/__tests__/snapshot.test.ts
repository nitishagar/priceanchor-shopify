import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  numericId,
  runSnapshotForAllShops,
  SNAPSHOT_MAX_PAGES,
  SNAPSHOT_PAGE_SIZE,
  snapshotShop,
} from "../services/snapshot.server";

const CAPTURE_OK = {
  recorded: 1,
  skippedUnchanged: 0,
  metafieldsWritten: 2,
  metafieldErrors: [],
  productKnown: true,
  autoCleared: 0,
  autoClearErrors: [],
};

function productsPage(
  nodes: Array<{ id: string; variants: Array<{ id: string; price: string; compareAtPrice?: string | null }> }>,
  hasNextPage: boolean,
  endCursor: string | null = null,
) {
  return {
    json: async () => ({
      data: {
        products: {
          pageInfo: { hasNextPage, endCursor },
          nodes: nodes.map((p) => ({
            id: p.id,
            title: "P",
            variants: {
              nodes: p.variants.map((v) => ({
                id: v.id,
                price: v.price,
                compareAtPrice: v.compareAtPrice ?? null,
              })),
            },
          })),
        },
      },
    }),
  };
}

describe("numericId", () => {
  it("strips Shopify GIDs to numeric ids", () => {
    expect(numericId("gid://shopify/Product/123")).toBe("123");
    expect(numericId("gid://shopify/ProductVariant/11")).toBe("11");
    expect(numericId(undefined)).toBe("");
  });
});

describe("snapshotShop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("paginates the catalog and captures every product as a snapshot", async () => {
    const graphql = vi
      .fn()
      .mockResolvedValueOnce(
        productsPage(
          [{ id: "gid://shopify/Product/1", variants: [{ id: "gid://shopify/ProductVariant/11", price: "19.99" }] }],
          true,
          "cursor-1",
        ),
      )
      .mockResolvedValueOnce(
        productsPage(
          [{ id: "gid://shopify/Product/2", variants: [{ id: "gid://shopify/ProductVariant/21", price: "9.99", compareAtPrice: "12.99" }] }],
          false,
        ),
      );
    const capture = vi.fn().mockResolvedValue(CAPTURE_OK);

    const result = await snapshotShop(
      "s.myshopify.com",
      { graphql },
      {} as never,
      capture as never,
    );

    expect(graphql).toHaveBeenCalledTimes(2);
    expect(graphql.mock.calls[0][1].variables).toEqual({
      first: SNAPSHOT_PAGE_SIZE,
      after: null,
    });
    expect(graphql.mock.calls[1][1].variables).toEqual({
      first: SNAPSHOT_PAGE_SIZE,
      after: "cursor-1",
    });
    expect(capture).toHaveBeenCalledTimes(2);
    expect(vi.mocked(capture).mock.calls[0].slice(0, 5)).toEqual([
      "s.myshopify.com",
      { graphql },
      {
        id: "1",
        title: "P",
        variants: [{ id: "11", price: "19.99", compare_at_price: null }],
      },
      expect.anything(),
      "snapshot",
    ]);
    expect(result).toMatchObject({
      shop: "s.myshopify.com",
      productsSeen: 2,
      recorded: 2,
      metafieldsWritten: 4,
      errors: [],
    });
  });

  it("stops paginating after the page cap", async () => {
    const graphql = vi.fn().mockResolvedValue(productsPage([], true, "cursor"));
    const capture = vi.fn().mockResolvedValue(CAPTURE_OK);

    await snapshotShop("s.myshopify.com", { graphql }, {} as never, capture as never);

    expect(graphql).toHaveBeenCalledTimes(SNAPSHOT_MAX_PAGES);
  });

  it("records GraphQL failures and keeps partial progress", async () => {
    const graphql = vi.fn().mockRejectedValue(new Error("throttled"));
    const capture = vi.fn();

    const result = await snapshotShop(
      "s.myshopify.com",
      { graphql },
      {} as never,
      capture as never,
    );

    expect(result.productsSeen).toBe(0);
    expect(result.errors).toEqual(["throttled"]);
    expect(capture).not.toHaveBeenCalled();
  });

  it("collects per-product capture errors without aborting the page", async () => {
    const graphql = vi.fn().mockResolvedValue(
      productsPage(
        [
          { id: "gid://shopify/Product/1", variants: [{ id: "gid://shopify/ProductVariant/11", price: "19.99" }] },
          { id: "gid://shopify/Product/2", variants: [{ id: "gid://shopify/ProductVariant/21", price: "9.99" }] },
        ],
        false,
      ),
    );
    const capture = vi
      .fn()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce(CAPTURE_OK);

    const result = await snapshotShop(
      "s.myshopify.com",
      { graphql },
      {} as never,
      capture as never,
    );

    expect(result.productsSeen).toBe(2);
    expect(result.recorded).toBe(1);
    expect(result.errors).toEqual(["db down"]);
  });
});

describe("runSnapshotForAllShops", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDb = (domains: string[]) =>
    ({
      query: {
        shops: {
          findMany: vi.fn().mockResolvedValue(domains.map((domain) => ({ domain }))),
        },
      },
    }) as never;

  it("snapshots every shop and aggregates totals", async () => {
    const admin = { graphql: vi.fn() };
    const getAdmin = vi.fn().mockResolvedValue(admin);
    const capture = vi.fn().mockResolvedValue(CAPTURE_OK);
    admin.graphql.mockResolvedValue(productsPage([], false));

    const run = await runSnapshotForAllShops(
      getAdmin,
      mockDb(["a.myshopify.com", "b.myshopify.com"]),
      capture as never,
    );

    expect(run.shops).toBe(2);
    expect(run.results).toHaveLength(2);
    expect(getAdmin).toHaveBeenCalledWith("a.myshopify.com");
    expect(getAdmin).toHaveBeenCalledWith("b.myshopify.com");
  });

  it("records shops without an offline session and continues", async () => {
    const admin = { graphql: vi.fn() };
    admin.graphql.mockResolvedValue(productsPage([], false));
    const getAdmin = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(admin);
    const capture = vi.fn().mockResolvedValue(CAPTURE_OK);

    const run = await runSnapshotForAllShops(
      getAdmin,
      mockDb(["a.myshopify.com", "b.myshopify.com"]),
      capture as never,
    );

    expect(run.results[0]).toMatchObject({
      shop: "a.myshopify.com",
      errors: ["no offline session"],
    });
    expect(run.results[1]?.errors).toEqual([]);
  });

  it("records admin lookup failures and continues", async () => {
    const getAdmin = vi
      .fn()
      .mockRejectedValueOnce(new Error("auth expired"))
      .mockResolvedValueOnce({ graphql: vi.fn().mockResolvedValue(productsPage([], false)) });
    const capture = vi.fn().mockResolvedValue(CAPTURE_OK);

    const run = await runSnapshotForAllShops(
      getAdmin,
      mockDb(["a.myshopify.com", "b.myshopify.com"]),
      capture as never,
    );

    expect(run.results[0]).toMatchObject({
      shop: "a.myshopify.com",
      errors: ["auth expired"],
    });
    expect(run.shops).toBe(2);
  });
});

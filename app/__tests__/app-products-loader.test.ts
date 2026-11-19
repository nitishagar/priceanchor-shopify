import { describe, it, expect, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";
import { testContext } from "./helpers/test-env";

const mockDb = vi.hoisted(() => ({
  query: {
    shops: {
      findFirst: vi.fn().mockResolvedValue({
        id: 1,
        plan: "free",
        trackedCount: 0,
        productLimit: 25,
      }),
    },
    priceSnapshots: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("../db.server", () => ({ getDb: () => mockDb }));

vi.mock("../shopify.server", () => ({
  getShopify: () => ({
    authenticate: {
      admin: vi.fn().mockResolvedValue({ session: { shop: "s.myshopify.com" } }),
    },
  }),
}));

describe("app.products loader row cap", () => {
  it("limits history reads to 5000 rows", async () => {
    const { loader } = await import("../routes/app.products");
    const data = (await loader({
      request: new Request("http://localhost/app/products"),
      params: {},
      context: testContext(),
    } as unknown as ActionFunctionArgs)) as { products: unknown[] };

    expect(data.products).toEqual([]);
    expect(mockDb.query.priceSnapshots.findMany).toHaveBeenCalledTimes(1);
    const query = mockDb.query.priceSnapshots.findMany.mock.calls[0][0] as {
      limit?: number;
    };
    expect(query.limit).toBe(5000);
  });
});

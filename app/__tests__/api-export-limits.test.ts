import { describe, it, expect, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";
import { testContext } from "./helpers/test-env";

const mockDb = vi.hoisted(() => ({
  query: {
    shops: {
      findFirst: vi.fn().mockResolvedValue({ id: 1, plan: "standard" }),
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

describe("api.export row cap", () => {
  it("limits history reads to 10000 rows", async () => {
    const { loader } = await import("../routes/api.export");
    const response = await loader({
      request: new Request("http://localhost/api/export?format=csv"),
      params: {},
      context: testContext(),
    } as unknown as ActionFunctionArgs);

    expect(response.status).toBe(200);
    expect(mockDb.query.priceSnapshots.findMany).toHaveBeenCalledTimes(1);
    const query = mockDb.query.priceSnapshots.findMany.mock.calls[0][0] as {
      limit?: number;
    };
    expect(query.limit).toBe(10000);
  });
});

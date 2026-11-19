import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ActionFunctionArgs } from "react-router";
import { testContext, testEnv } from "./helpers/test-env";

const makeArgs = (request: Request) =>
  ({ request, params: {}, context: testContext() }) as unknown as ActionFunctionArgs;

const mockAuthenticate = vi.hoisted(() => ({
  webhook: vi.fn(),
}));

vi.mock("../shopify.server", () => ({
  getShopify: () => ({
    authenticate: mockAuthenticate,
  }),
}));

const mockDb = vi.hoisted(() => ({
  query: {
    shops: {
      findFirst: vi.fn(),
    },
  },
  delete: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../db.server", () => ({ getDb: () => mockDb }));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

vi.mock("../db/schema", () => ({
  shops: { id: "shops.id", domain: "shops.domain" },
  sessionTable: { shop: "sessionTable.shop" },
  priceSnapshots: { shopId: "priceSnapshots.shopId" },
}));

describe("Consolidated /webhooks compliance handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("HMAC validation", () => {
    it("propagates 401 Response thrown by authenticate.webhook on bad HMAC", async () => {
      const { getShopify } = await import("../shopify.server");
      const { authenticate } = getShopify(testEnv());
      const unauthorized = new Response(null, {
        status: 401,
        statusText: "Unauthorized",
      });
      vi.mocked(authenticate.webhook).mockRejectedValue(unauthorized);

      const { action } = await import("../routes/webhooks._index");
      const request = new Request("http://localhost/webhooks", {
        method: "POST",
        body: "{}",
      });

      await expect(action(makeArgs(request))).rejects.toBe(unauthorized);
    });
  });

  describe("customers/data_request topic", () => {
    it("returns 200", async () => {
      const { getShopify } = await import("../shopify.server");
      const { authenticate } = getShopify(testEnv());
      vi.mocked(authenticate.webhook).mockResolvedValue({
        shop: "test-shop.myshopify.com",
        topic: "CUSTOMERS_DATA_REQUEST",
        payload: { customer: { id: 123 } },
        session: undefined,
        admin: undefined,
      } as never);

      const { action } = await import("../routes/webhooks._index");
      const request = new Request("http://localhost/webhooks", {
        method: "POST",
        body: "{}",
      });

      const response = await action(makeArgs(request));
      expect(response.status).toBe(200);
    });

    it("accepts lowercase slash-form topic", async () => {
      const { getShopify } = await import("../shopify.server");
      const { authenticate } = getShopify(testEnv());
      vi.mocked(authenticate.webhook).mockResolvedValue({
        shop: "test-shop.myshopify.com",
        topic: "customers/data_request",
        payload: {},
        session: undefined,
        admin: undefined,
      } as never);

      const { action } = await import("../routes/webhooks._index");
      const request = new Request("http://localhost/webhooks", {
        method: "POST",
        body: "{}",
      });

      const response = await action(makeArgs(request));
      expect(response.status).toBe(200);
    });
  });

  describe("customers/redact topic", () => {
    it("returns 200", async () => {
      const { getShopify } = await import("../shopify.server");
      const { authenticate } = getShopify(testEnv());
      vi.mocked(authenticate.webhook).mockResolvedValue({
        shop: "test-shop.myshopify.com",
        topic: "CUSTOMERS_REDACT",
        payload: { customer: { id: 456 } },
        session: undefined,
        admin: undefined,
      } as never);

      const { action } = await import("../routes/webhooks._index");
      const request = new Request("http://localhost/webhooks", {
        method: "POST",
        body: "{}",
      });

      const response = await action(makeArgs(request));
      expect(response.status).toBe(200);
    });
  });

  describe("shop/redact topic", () => {
    it("returns 200 when shop is not found in database", async () => {
      const { getShopify } = await import("../shopify.server");
      const { authenticate } = getShopify(testEnv());
      vi.mocked(authenticate.webhook).mockResolvedValue({
        shop: "unknown-shop.myshopify.com",
        topic: "SHOP_REDACT",
        payload: {},
        session: undefined,
        admin: undefined,
      } as never);

            vi.mocked(mockDb.query.shops.findFirst).mockResolvedValue(undefined);

      const { action } = await import("../routes/webhooks._index");
      const request = new Request("http://localhost/webhooks", {
        method: "POST",
        body: "{}",
      });

      const response = await action(makeArgs(request));
      expect(response.status).toBe(200);
    });

    it("wraps all deletes in a transaction", async () => {
      const { getShopify } = await import("../shopify.server");
      const { authenticate } = getShopify(testEnv());
      vi.mocked(authenticate.webhook).mockResolvedValue({
        shop: "test-shop.myshopify.com",
        topic: "SHOP_REDACT",
        payload: {},
        session: undefined,
        admin: undefined,
      } as never);

            const mockShop = { id: 42, domain: "test-shop.myshopify.com" };
      vi.mocked(mockDb.query.shops.findFirst).mockResolvedValue(mockShop as never);

      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockTxDelete = vi.fn().mockReturnValue({ where: mockWhere });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(mockDb.transaction).mockImplementation(async (cb: any) => {
        const tx = { delete: mockTxDelete };
        return cb(tx);
      });

      const { action } = await import("../routes/webhooks._index");
      const request = new Request("http://localhost/webhooks", {
        method: "POST",
        body: "{}",
      });

      const response = await action(makeArgs(request));
      expect(response.status).toBe(200);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it("deletes all data in correct order: priceSnapshots, sessionTable, shops", async () => {
      const { getShopify } = await import("../shopify.server");
      const { authenticate } = getShopify(testEnv());
      const { eq } = await import("drizzle-orm");
      vi.mocked(authenticate.webhook).mockResolvedValue({
        shop: "test-shop.myshopify.com",
        topic: "SHOP_REDACT",
        payload: {},
        session: undefined,
        admin: undefined,
      } as never);

            const mockShop = { id: 42, domain: "test-shop.myshopify.com" };
      vi.mocked(mockDb.query.shops.findFirst).mockResolvedValue(mockShop as never);

      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockTxDelete = vi.fn().mockReturnValue({ where: mockWhere });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(mockDb.transaction).mockImplementation(async (cb: any) => {
        const tx = { delete: mockTxDelete };
        return cb(tx);
      });

      const schema = await import("../db/schema");

      const { action } = await import("../routes/webhooks._index");
      const request = new Request("http://localhost/webhooks", {
        method: "POST",
        body: "{}",
      });

      await action(makeArgs(request));

      expect(mockTxDelete).toHaveBeenCalledTimes(3);
      expect(mockTxDelete.mock.calls[0][0]).toBe(schema.priceSnapshots);
      expect(mockTxDelete.mock.calls[1][0]).toBe(schema.sessionTable);
      expect(mockTxDelete.mock.calls[2][0]).toBe(schema.shops);

      expect(mockWhere).toHaveBeenCalledTimes(3);
      expect(eq).toHaveBeenCalledWith("priceSnapshots.shopId", 42);
      expect(eq).toHaveBeenCalledWith("sessionTable.shop", "test-shop.myshopify.com");
      expect(eq).toHaveBeenCalledWith("shops.id", 42);
    });

    it("deletes sessionTable records by shop domain", async () => {
      const { getShopify } = await import("../shopify.server");
      const { authenticate } = getShopify(testEnv());
      const { eq } = await import("drizzle-orm");
      vi.mocked(authenticate.webhook).mockResolvedValue({
        shop: "my-store.myshopify.com",
        topic: "SHOP_REDACT",
        payload: {},
        session: undefined,
        admin: undefined,
      } as never);

            const mockShop = { id: 99, domain: "my-store.myshopify.com" };
      vi.mocked(mockDb.query.shops.findFirst).mockResolvedValue(mockShop as never);

      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockTxDelete = vi.fn().mockReturnValue({ where: mockWhere });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(mockDb.transaction).mockImplementation(async (cb: any) => {
        const tx = { delete: mockTxDelete };
        return cb(tx);
      });

      const schema = await import("../db/schema");

      const { action } = await import("../routes/webhooks._index");
      const request = new Request("http://localhost/webhooks", {
        method: "POST",
        body: "{}",
      });

      await action(makeArgs(request));

      expect(mockTxDelete.mock.calls[1][0]).toBe(schema.sessionTable);
      expect(eq).toHaveBeenCalledWith("sessionTable.shop", "my-store.myshopify.com");
    });
  });

  describe("unknown topic", () => {
    it("returns 404 for topics not in the compliance set", async () => {
      const { getShopify } = await import("../shopify.server");
      const { authenticate } = getShopify(testEnv());
      vi.mocked(authenticate.webhook).mockResolvedValue({
        shop: "test-shop.myshopify.com",
        topic: "ORDERS_CREATE",
        payload: {},
        session: undefined,
        admin: undefined,
      } as never);

      const { action } = await import("../routes/webhooks._index");
      const request = new Request("http://localhost/webhooks", {
        method: "POST",
        body: "{}",
      });

      const response = await action(makeArgs(request));
      expect(response.status).toBe(404);
    });
  });
});

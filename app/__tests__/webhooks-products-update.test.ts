import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ActionFunctionArgs } from "react-router";
import { testContext, testEnv } from "./helpers/test-env";

const makeArgs = (request: Request) =>
  ({ request, params: {}, context: testContext() }) as unknown as ActionFunctionArgs;

const mockAuthenticate = vi.hoisted(() => ({
  webhook: vi.fn(),
  admin: vi.fn(),
}));

vi.mock("../shopify.server", () => ({
  getShopify: () => ({
    authenticate: mockAuthenticate,
  }),
}));

vi.mock("../services/price-webhook.server", () => ({
  handleProductPriceCapture: vi.fn(),
  handleProductDelete: vi.fn(),
}));

function authed(topic: string, product: unknown) {
  return {
    shop: "test-shop.myshopify.com",
    topic,
    payload: product,
    session: undefined,
    admin: { graphql: vi.fn() },
  } as never;
}

const productPayload = {
  id: 123,
  title: "Test product",
  variants: [{ id: 11, price: "19.99", compare_at_price: null }],
};

describe("products/create webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captures prices and returns 200", async () => {
    const { getShopify } = await import("../shopify.server");
    const { authenticate } = getShopify(testEnv());
    vi.mocked(authenticate.webhook).mockResolvedValue(
      authed("PRODUCTS_CREATE", productPayload),
    );
    const { handleProductPriceCapture } = await import(
      "../services/price-webhook.server"
    );
    vi.mocked(handleProductPriceCapture).mockResolvedValue({
      recorded: 1,
      skippedUnchanged: 0,
      metafieldsWritten: 1,
      metafieldErrors: [],
      productKnown: false,
      autoCleared: 0,
      autoClearErrors: [],
    });

    const { action } = await import("../routes/webhooks.products-create");
    const response = await action(
      makeArgs(new Request("http://localhost/webhooks/products-create", { method: "POST", body: "{}" })),
    );

    expect(response.status).toBe(200);
    expect(handleProductPriceCapture).toHaveBeenCalledTimes(1);
    expect(vi.mocked(handleProductPriceCapture).mock.calls[0][0]).toBe(
      "test-shop.myshopify.com",
    );
    expect(vi.mocked(handleProductPriceCapture).mock.calls[0][2]).toEqual(
      productPayload,
    );
  });

  it("still returns 200 when the handler throws (Shopify retries otherwise)", async () => {
    const { getShopify } = await import("../shopify.server");
    const { authenticate } = getShopify(testEnv());
    vi.mocked(authenticate.webhook).mockResolvedValue(
      authed("PRODUCTS_CREATE", productPayload),
    );
    const { handleProductPriceCapture } = await import(
      "../services/price-webhook.server"
    );
    vi.mocked(handleProductPriceCapture).mockRejectedValue(new Error("db down"));

    const { action } = await import("../routes/webhooks.products-create");
    const response = await action(
      makeArgs(new Request("http://localhost/webhooks/products-create", { method: "POST", body: "{}" })),
    );

    expect(response.status).toBe(200);
  });
});

describe("products/update webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to price capture (diffing lives in the service)", async () => {
    const { getShopify } = await import("../shopify.server");
    const { authenticate } = getShopify(testEnv());
    vi.mocked(authenticate.webhook).mockResolvedValue(
      authed("PRODUCTS_UPDATE", productPayload),
    );
    const { handleProductPriceCapture } = await import(
      "../services/price-webhook.server"
    );
    // Non-price edit: everything unchanged, nothing recorded.
    vi.mocked(handleProductPriceCapture).mockResolvedValue({
      recorded: 0,
      skippedUnchanged: 1,
      metafieldsWritten: 0,
      metafieldErrors: [],
      productKnown: true,
      autoCleared: 0,
      autoClearErrors: [],
    });

    const { action } = await import("../routes/webhooks.products-update");
    const response = await action(
      makeArgs(new Request("http://localhost/webhooks/products-update", { method: "POST", body: "{}" })),
    );

    expect(response.status).toBe(200);
    expect(handleProductPriceCapture).toHaveBeenCalledTimes(1);
  });

  it("still returns 200 when the handler throws", async () => {
    const { getShopify } = await import("../shopify.server");
    const { authenticate } = getShopify(testEnv());
    vi.mocked(authenticate.webhook).mockResolvedValue(
      authed("PRODUCTS_UPDATE", productPayload),
    );
    const { handleProductPriceCapture } = await import(
      "../services/price-webhook.server"
    );
    vi.mocked(handleProductPriceCapture).mockRejectedValue(new Error("db down"));

    const { action } = await import("../routes/webhooks.products-update");
    const response = await action(
      makeArgs(new Request("http://localhost/webhooks/products-update", { method: "POST", body: "{}" })),
    );

    expect(response.status).toBe(200);
  });
});

describe("products/delete webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reconciles tracking and returns 200", async () => {
    const { getShopify } = await import("../shopify.server");
    const { authenticate } = getShopify(testEnv());
    vi.mocked(authenticate.webhook).mockResolvedValue(
      authed("PRODUCTS_DELETE", { id: 123 }),
    );
    const { handleProductDelete } = await import(
      "../services/price-webhook.server"
    );
    vi.mocked(handleProductDelete).mockResolvedValue({ reconciled: true });

    const { action } = await import("../routes/webhooks.products-delete");
    const response = await action(
      makeArgs(new Request("http://localhost/webhooks/products-delete", { method: "POST", body: "{}" })),
    );

    expect(response.status).toBe(200);
    expect(handleProductDelete).toHaveBeenCalledWith(
      "test-shop.myshopify.com",
      123,
      expect.anything(),
    );
  });
});

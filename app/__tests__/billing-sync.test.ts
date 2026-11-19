import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb, updateChain } = vi.hoisted(() => {
  const updateChain = {
    set: vi.fn(),
    where: vi.fn(),
  };
  return {
    updateChain,
    mockDb: {
      query: {
        shops: {
          findFirst: vi.fn(),
        },
      },
      update: vi.fn(() => ({
        set: vi.fn((vals: unknown) => {
          updateChain.set(vals);
          return {
            where: vi.fn((w: unknown) => {
              updateChain.where(w);
              return Promise.resolve();
            }),
          };
        }),
      })),
    },
  };
});

vi.mock("../db.server", () => ({ getDb: () => mockDb }));

import { syncPlanFromShopify, getCurrentPlan, managedPricingUrl } from "../services/billing/billing.server";

function makeAdmin(activeSubscriptions: Array<{ name: string; status: string }>) {
  return {
    graphql: vi.fn().mockResolvedValue({
      json: async () => ({
        data: {
          currentAppInstallation: {
            activeSubscriptions,
          },
        },
      }),
    }),
  };
}

describe("syncPlanFromShopify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateChain.set.mockClear();
    updateChain.where.mockClear();
  });

  it("updates shop plan to unlimited when active Unlimited subscription exists", async () => {
    mockDb.query.shops.findFirst.mockResolvedValue({
      id: 1,
      domain: "test.myshopify.com",
      plan: "free",
      productLimit: 25,
    });
    const admin = makeAdmin([{ name: "Unlimited", status: "ACTIVE" }]);

    const plan = await syncPlanFromShopify("test.myshopify.com", admin, mockDb as never);

    expect(plan).toBe("unlimited");
    expect(mockDb.update).toHaveBeenCalled();
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "unlimited" }),
    );
  });

  it("updates shop plan to standard when active Standard subscription exists", async () => {
    mockDb.query.shops.findFirst.mockResolvedValue({
      id: 1,
      domain: "test.myshopify.com",
      plan: "free",
      productLimit: 25,
    });
    const admin = makeAdmin([{ name: "Standard", status: "ACTIVE" }]);

    const plan = await syncPlanFromShopify("test.myshopify.com", admin, mockDb as never);

    expect(plan).toBe("standard");
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "standard", productLimit: 250 }),
    );
  });

  it("downgrades to free when no active subscriptions exist", async () => {
    mockDb.query.shops.findFirst.mockResolvedValue({
      id: 1,
      domain: "test.myshopify.com",
      plan: "unlimited",
      productLimit: 999999,
    });
    const admin = makeAdmin([]);

    const plan = await syncPlanFromShopify("test.myshopify.com", admin, mockDb as never);

    expect(plan).toBe("free");
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "free", productLimit: 25 }),
    );
  });

  it("ignores non-ACTIVE subscriptions", async () => {
    mockDb.query.shops.findFirst.mockResolvedValue({
      id: 1,
      domain: "test.myshopify.com",
      plan: "free",
      productLimit: 25,
    });
    const admin = makeAdmin([
      { name: "Unlimited", status: "CANCELLED" },
      { name: "Standard", status: "PENDING" },
    ]);

    const plan = await syncPlanFromShopify("test.myshopify.com", admin, mockDb as never);

    expect(plan).toBe("free");
  });

  it("is a no-op write when current plan already matches", async () => {
    mockDb.query.shops.findFirst.mockResolvedValue({
      id: 1,
      domain: "test.myshopify.com",
      plan: "unlimited",
      productLimit: 999999,
    });
    const admin = makeAdmin([{ name: "Unlimited", status: "ACTIVE" }]);

    const plan = await syncPlanFromShopify("test.myshopify.com", admin, mockDb as never);

    expect(plan).toBe("unlimited");
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("returns free and does not write when shop is not found", async () => {
    mockDb.query.shops.findFirst.mockResolvedValue(null);
    const admin = makeAdmin([{ name: "Unlimited", status: "ACTIVE" }]);

    const plan = await syncPlanFromShopify("missing.myshopify.com", admin, mockDb as never);

    expect(plan).toBe("free");
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("falls back to free when GraphQL throws", async () => {
    mockDb.query.shops.findFirst.mockResolvedValue({
      id: 1,
      domain: "test.myshopify.com",
      plan: "unlimited",
      productLimit: 999999,
    });
    const admin = {
      graphql: vi.fn().mockRejectedValue(new Error("network down")),
    };

    const plan = await syncPlanFromShopify("test.myshopify.com", admin, mockDb as never);

    expect(plan).toBe("free");
    // No write attempted on error
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});

describe("getCurrentPlan", () => {
  it("returns the typed plan when valid", () => {
    expect(getCurrentPlan({ plan: "unlimited" })).toBe("unlimited");
    expect(getCurrentPlan({ plan: "standard" })).toBe("standard");
    expect(getCurrentPlan({ plan: "free" })).toBe("free");
  });

  it("falls back to free for unknown values", () => {
    expect(getCurrentPlan({ plan: "enterprise" })).toBe("free");
    expect(getCurrentPlan({ plan: "" })).toBe("free");
  });
});

describe("managedPricingUrl", () => {
  it("returns the Shopify Managed Pricing deep-link", () => {
    expect(managedPricingUrl()).toBe(
      "shopify://admin/charges/priceanchor/pricing_plans",
    );
  });

  it("uses the given handle", () => {
    expect(managedPricingUrl("priceanchor-test")).toBe(
      "shopify://admin/charges/priceanchor-test/pricing_plans",
    );
  });
});

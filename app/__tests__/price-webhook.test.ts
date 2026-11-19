import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/shop.server", () => ({
  getOrCreateShop: vi.fn(),
}));

vi.mock("../services/price-history.server", () => ({
  diffVariantPrices: vi.fn(),
  distinctProductCount: vi.fn(),
  recordSnapshot: vi.fn(),
  snapshotsForVariant: vi.fn(),
}));

vi.mock("../services/lowest-price.server", () => ({
  euPriorPrice: vi.fn(),
  caFormerPriceHeuristic: vi.fn(),
  compareAtSince: vi.fn(),
  lastObservedAt: vi.fn(),
}));

vi.mock("../services/metafields.server", () => ({
  writeLowestPriceMetafield: vi.fn(),
  writeFormerPriceMetafield: vi.fn(),
}));

vi.mock("../services/plan-enforcer.server", () => ({
  checkPlanAllowsProduct: vi.fn(),
  getPlanCapabilities: vi.fn(),
}));

vi.mock("../services/stale-guard.server", () => ({
  classifyStale: vi.fn(),
  clearCompareAtPrice: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({
  query: {
    priceSnapshots: {
      findFirst: vi.fn(),
    },
  },
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
  })),
}));

vi.mock("../db.server", () => ({ getDb: () => mockDb }));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((col, val) => ({ col, val })),
}));

import { getOrCreateShop } from "../services/shop.server";
import {
  diffVariantPrices,
  distinctProductCount,
  recordSnapshot,
  snapshotsForVariant,
} from "../services/price-history.server";
import {
  caFormerPriceHeuristic,
  compareAtSince,
  euPriorPrice,
  lastObservedAt,
} from "../services/lowest-price.server";
import {
  writeFormerPriceMetafield,
  writeLowestPriceMetafield,
} from "../services/metafields.server";
import {
  checkPlanAllowsProduct,
  getPlanCapabilities,
} from "../services/plan-enforcer.server";
import {
  classifyStale,
  clearCompareAtPrice,
} from "../services/stale-guard.server";
import { handleProductPriceCapture } from "../services/price-webhook.server";

const SHOP = { id: 1, domain: "s.myshopify.com", plan: "free", trackedCount: 0 };

describe("handleProductPriceCapture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrCreateShop).mockResolvedValue(SHOP as never);
    vi.mocked(distinctProductCount).mockResolvedValue(1);
    // Default: no US former-price history, auto-clear disabled.
    vi.mocked(caFormerPriceHeuristic).mockReturnValue({
      lowestMinor: null,
      snapshotCount: 0,
      windowDays: 90,
      windowStart: new Date(),
      asOf: new Date(),
    });
    vi.mocked(getPlanCapabilities).mockReturnValue({
      productLimit: 25,
      exportCsv: false,
      exportPdf: false,
      staleGuard: false,
      autoClear: false,
      prioritySupport: false,
    });
    vi.mocked(classifyStale).mockReturnValue("fresh");
  });

  it("records changed variants and refreshes the metafield", async () => {
    mockDb.query.priceSnapshots.findFirst.mockResolvedValue({ id: 1 }); // known product
    vi.mocked(diffVariantPrices).mockResolvedValue([
      {
        variantId: "11",
        priceMinor: 1799,
        compareAtMinor: 2499,
        previousPriceMinor: 1999,
        previousCompareAtMinor: null,
        changed: true,
      },
      {
        variantId: "12",
        priceMinor: 999,
        compareAtMinor: null,
        previousPriceMinor: 999,
        previousCompareAtMinor: null,
        changed: false,
      },
    ]);
    vi.mocked(recordSnapshot).mockResolvedValue({ id: 10 } as never);
    vi.mocked(snapshotsForVariant).mockResolvedValue([
      { priceMinor: 1799, capturedAt: new Date() },
    ]);
    vi.mocked(euPriorPrice).mockReturnValue({
      lowestMinor: 1799,
      snapshotCount: 1,
      windowDays: 30,
      windowStart: new Date(),
      asOf: new Date(),
    });
    vi.mocked(writeLowestPriceMetafield).mockResolvedValue({
      ok: true,
      key: "lowest_price_default",
    });

    const result = await handleProductPriceCapture(
      SHOP.domain,
      { graphql: vi.fn() },
      {
        id: 123,
        variants: [
          { id: 11, price: "17.99", compare_at_price: "24.99" },
          { id: 12, price: "9.99" },
        ],
      },
      mockDb as never,
    );

    expect(result).toMatchObject({
      recorded: 1,
      skippedUnchanged: 1,
      metafieldsWritten: 1,
      productKnown: true,
    });
    expect(recordSnapshot).toHaveBeenCalledTimes(1);
    expect(writeLowestPriceMetafield).toHaveBeenCalledTimes(1);
    expect(vi.mocked(writeLowestPriceMetafield).mock.calls[0][1]).toBe(
      "gid://shopify/Product/123",
    );
  });

  it("records nothing when no price changed", async () => {
    mockDb.query.priceSnapshots.findFirst.mockResolvedValue({ id: 1 });
    vi.mocked(diffVariantPrices).mockResolvedValue([
      {
        variantId: "11",
        priceMinor: 1999,
        compareAtMinor: null,
        previousPriceMinor: 1999,
        previousCompareAtMinor: null,
        changed: false,
      },
    ]);

    const result = await handleProductPriceCapture(
      SHOP.domain,
      { graphql: vi.fn() },
      { id: 123, variants: [{ id: 11, price: "19.99" }] },
      mockDb as never,
    );

    expect(result).toMatchObject({ recorded: 0, skippedUnchanged: 1 });
    expect(recordSnapshot).not.toHaveBeenCalled();
    expect(writeLowestPriceMetafield).not.toHaveBeenCalled();
  });

  it("refuses to track a new product when the plan is full", async () => {
    mockDb.query.priceSnapshots.findFirst.mockResolvedValue(undefined); // unknown product
    vi.mocked(checkPlanAllowsProduct).mockResolvedValue({
      allowed: false,
      reason: "Plan limit reached",
      currentCount: 25,
      limit: 25,
      exportCsv: false,
      exportPdf: false,
      staleGuard: false,
      autoClear: false,
      prioritySupport: false,
    });

    const result = await handleProductPriceCapture(
      SHOP.domain,
      { graphql: vi.fn() },
      { id: 999, variants: [{ id: 91, price: "5.99" }] },
      mockDb as never,
    );

    expect(result).toMatchObject({ recorded: 0, productKnown: false });
    expect(checkPlanAllowsProduct).toHaveBeenCalledWith(1, mockDb, 1);
    expect(diffVariantPrices).not.toHaveBeenCalled();
  });

  it("skips the plan check for already-tracked products", async () => {
    mockDb.query.priceSnapshots.findFirst.mockResolvedValue({ id: 1 });
    vi.mocked(diffVariantPrices).mockResolvedValue([]);

    await handleProductPriceCapture(
      SHOP.domain,
      null,
      { id: 123, variants: [{ id: 11, price: "19.99" }] },
      mockDb as never,
    );

    expect(checkPlanAllowsProduct).not.toHaveBeenCalled();
  });

  it("collects metafield errors without failing the capture", async () => {
    mockDb.query.priceSnapshots.findFirst.mockResolvedValue({ id: 1 });
    vi.mocked(diffVariantPrices).mockResolvedValue([
      {
        variantId: "11",
        priceMinor: 1799,
        compareAtMinor: null,
        previousPriceMinor: 1999,
        previousCompareAtMinor: null,
        changed: true,
      },
    ]);
    vi.mocked(snapshotsForVariant).mockResolvedValue([
      { priceMinor: 1799, capturedAt: new Date() },
    ]);
    vi.mocked(euPriorPrice).mockReturnValue({
      lowestMinor: 1799,
      snapshotCount: 1,
      windowDays: 30,
      windowStart: new Date(),
      asOf: new Date(),
    });
    vi.mocked(writeLowestPriceMetafield).mockRejectedValue(
      new Error("access denied"),
    );

    const result = await handleProductPriceCapture(
      SHOP.domain,
      { graphql: vi.fn() },
      { id: 123, variants: [{ id: 11, price: "17.99" }] },
      mockDb as never,
    );

    expect(result.recorded).toBe(1);
    expect(result.metafieldsWritten).toBe(0);
    expect(result.metafieldErrors).toEqual(["access denied"]);
  });

  it("ignores payloads with no variants", async () => {
    const result = await handleProductPriceCapture(
      SHOP.domain,
      null,
      { id: 123, variants: [] },
      mockDb as never,
    );

    expect(result.recorded).toBe(0);
    expect(diffVariantPrices).not.toHaveBeenCalled();
  });

  it("writes the US former-price metafield with the last-offered date", async () => {
    mockDb.query.priceSnapshots.findFirst.mockResolvedValue({ id: 1 });
    vi.mocked(diffVariantPrices).mockResolvedValue([
      {
        variantId: "11",
        priceMinor: 1799,
        compareAtMinor: null,
        previousPriceMinor: 1999,
        previousCompareAtMinor: null,
        changed: true,
      },
    ]);
    const history = [{ priceMinor: 1799, capturedAt: new Date() }];
    vi.mocked(snapshotsForVariant).mockResolvedValue(history);
    vi.mocked(euPriorPrice).mockReturnValue({
      lowestMinor: 1799,
      snapshotCount: 1,
      windowDays: 30,
      windowStart: new Date(),
      asOf: new Date(),
    });
    vi.mocked(caFormerPriceHeuristic).mockReturnValue({
      lowestMinor: 1999,
      snapshotCount: 2,
      windowDays: 90,
      windowStart: new Date(),
      asOf: new Date(),
    });
    vi.mocked(lastObservedAt).mockReturnValue(
      new Date("2026-10-04T10:00:00.000Z"),
    );
    vi.mocked(writeLowestPriceMetafield).mockResolvedValue({
      ok: true,
      key: "lowest_price_default",
    });
    vi.mocked(writeFormerPriceMetafield).mockResolvedValue({
      ok: true,
      key: "former_price_default",
    });

    const result = await handleProductPriceCapture(
      SHOP.domain,
      { graphql: vi.fn() },
      { id: 123, variants: [{ id: 11, price: "17.99" }] },
      mockDb as never,
    );

    expect(result.metafieldsWritten).toBe(2);
    expect(writeFormerPriceMetafield).toHaveBeenCalledTimes(1);
    expect(vi.mocked(writeFormerPriceMetafield).mock.calls[0].slice(1)).toEqual([
      "gid://shopify/Product/123",
      "default",
      {
        lowestMinor: 1999,
        currency: "USD",
        lastOfferedAt: "2026-10-04T10:00:00.000Z",
        windowDays: 90,
        currentMinor: 1799,
      },
    ]);
  });

  it("auto-clears stale compare-at anchors on Unlimited when enabled", async () => {
    vi.mocked(getOrCreateShop).mockResolvedValue({
      ...SHOP,
      plan: "unlimited",
      settings: { warnDays: 60, reviewDays: 75, staleDays: 90, autoClear: true },
    } as never);
    vi.mocked(getPlanCapabilities).mockReturnValue({
      productLimit: Infinity,
      exportCsv: true,
      exportPdf: true,
      staleGuard: true,
      autoClear: true,
      prioritySupport: true,
    });
    mockDb.query.priceSnapshots.findFirst.mockResolvedValue({ id: 1 });
    vi.mocked(diffVariantPrices).mockResolvedValue([
      {
        variantId: "11",
        priceMinor: 1799,
        compareAtMinor: 2499,
        previousPriceMinor: 1799,
        previousCompareAtMinor: 2499,
        changed: true,
      },
    ]);
    vi.mocked(snapshotsForVariant).mockResolvedValue([
      { priceMinor: 1799, capturedAt: new Date(), compareAtMinor: 2499 },
    ]);
    vi.mocked(euPriorPrice).mockReturnValue({
      lowestMinor: null,
      snapshotCount: 0,
      windowDays: 30,
      windowStart: new Date(),
      asOf: new Date(),
    });
    vi.mocked(compareAtSince).mockReturnValue(
      new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
    );
    vi.mocked(classifyStale).mockReturnValue("stale");
    vi.mocked(clearCompareAtPrice).mockResolvedValue({
      ok: true,
      variantGid: "gid://shopify/ProductVariant/11",
    });

    const result = await handleProductPriceCapture(
      SHOP.domain,
      { graphql: vi.fn() },
      { id: 123, variants: [{ id: 11, price: "17.99", compare_at_price: "24.99" }] },
      mockDb as never,
    );

    expect(result.autoCleared).toBe(1);
    expect(result.autoClearErrors).toEqual([]);
    expect(clearCompareAtPrice).toHaveBeenCalledTimes(1);
    expect(vi.mocked(clearCompareAtPrice).mock.calls[0][1]).toBe(
      "gid://shopify/ProductVariant/11",
    );
  });

  it("does not auto-clear when the plan forbids it", async () => {
    vi.mocked(getOrCreateShop).mockResolvedValue({
      ...SHOP,
      plan: "standard",
      settings: { warnDays: 60, reviewDays: 75, staleDays: 90, autoClear: true },
    } as never);
    // beforeEach default: autoClear capability false.
    mockDb.query.priceSnapshots.findFirst.mockResolvedValue({ id: 1 });
    vi.mocked(diffVariantPrices).mockResolvedValue([
      {
        variantId: "11",
        priceMinor: 1799,
        compareAtMinor: 2499,
        previousPriceMinor: 1799,
        previousCompareAtMinor: 2499,
        changed: true,
      },
    ]);
    vi.mocked(snapshotsForVariant).mockResolvedValue([
      { priceMinor: 1799, capturedAt: new Date(), compareAtMinor: 2499 },
    ]);
    vi.mocked(euPriorPrice).mockReturnValue({
      lowestMinor: null,
      snapshotCount: 0,
      windowDays: 30,
      windowStart: new Date(),
      asOf: new Date(),
    });

    const result = await handleProductPriceCapture(
      SHOP.domain,
      { graphql: vi.fn() },
      { id: 123, variants: [{ id: 11, price: "17.99", compare_at_price: "24.99" }] },
      mockDb as never,
    );

    expect(result.autoCleared).toBe(0);
    expect(clearCompareAtPrice).not.toHaveBeenCalled();
  });

  it("collects auto-clear errors without failing the capture", async () => {
    vi.mocked(getOrCreateShop).mockResolvedValue({
      ...SHOP,
      plan: "unlimited",
      settings: { warnDays: 60, reviewDays: 75, staleDays: 90, autoClear: true },
    } as never);
    vi.mocked(getPlanCapabilities).mockReturnValue({
      productLimit: Infinity,
      exportCsv: true,
      exportPdf: true,
      staleGuard: true,
      autoClear: true,
      prioritySupport: true,
    });
    mockDb.query.priceSnapshots.findFirst.mockResolvedValue({ id: 1 });
    vi.mocked(diffVariantPrices).mockResolvedValue([
      {
        variantId: "11",
        priceMinor: 1799,
        compareAtMinor: 2499,
        previousPriceMinor: 1799,
        previousCompareAtMinor: 2499,
        changed: true,
      },
    ]);
    vi.mocked(snapshotsForVariant).mockResolvedValue([
      { priceMinor: 1799, capturedAt: new Date(), compareAtMinor: 2499 },
    ]);
    vi.mocked(euPriorPrice).mockReturnValue({
      lowestMinor: null,
      snapshotCount: 0,
      windowDays: 30,
      windowStart: new Date(),
      asOf: new Date(),
    });
    vi.mocked(compareAtSince).mockReturnValue(
      new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
    );
    vi.mocked(classifyStale).mockReturnValue("stale");
    vi.mocked(clearCompareAtPrice).mockResolvedValue({
      ok: false,
      variantGid: "gid://shopify/ProductVariant/11",
      error: "throttled",
    });

    const result = await handleProductPriceCapture(
      SHOP.domain,
      { graphql: vi.fn() },
      { id: 123, variants: [{ id: 11, price: "17.99", compare_at_price: "24.99" }] },
      mockDb as never,
    );

    expect(result.recorded).toBe(1);
    expect(result.autoCleared).toBe(0);
    expect(result.autoClearErrors).toEqual(["throttled"]);
  });
});

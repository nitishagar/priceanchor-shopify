import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db.server", () => ({
  db: {
    query: {
      priceSnapshots: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(),
    selectDistinct: vi.fn(),
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => col),
  eq: vi.fn((col, val) => ({ col, val })),
}));

import { db } from "../db.server";
import {
  diffVariantPrices,
  recordSnapshot,
  snapshotsForVariant,
} from "../services/price-history.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDb = db as any;

describe("diffVariantPrices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks every variant changed when no history exists", async () => {
    mockDb.query.priceSnapshots.findFirst.mockResolvedValue(undefined);

    const diffs = await diffVariantPrices(1, "p1", [
      { id: 11, price: "19.99", compare_at_price: "24.99" },
      { id: 12, price: "9.99" },
    ]);

    expect(diffs).toHaveLength(2);
    expect(diffs[0]).toMatchObject({
      variantId: "11",
      priceMinor: 1999,
      compareAtMinor: 2499,
      previousPriceMinor: null,
      changed: true,
    });
    expect(diffs[1]).toMatchObject({
      variantId: "12",
      priceMinor: 999,
      compareAtMinor: null,
      changed: true,
    });
  });

  it("skips variants whose price and compare-at are unchanged", async () => {
    // products/update fires on ANY edit — a title/tag change must not
    // create a snapshot.
    mockDb.query.priceSnapshots.findFirst.mockResolvedValue({
      priceMinor: 1999,
      compareAtMinor: 2499,
      capturedAt: new Date(),
      market: "default",
      currency: "USD",
    });

    const diffs = await diffVariantPrices(1, "p1", [
      { id: 11, price: "19.99", compare_at_price: "24.99" },
    ]);

    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.changed).toBe(false);
  });

  it("flags a price-only change", async () => {
    mockDb.query.priceSnapshots.findFirst.mockResolvedValue({
      priceMinor: 1999,
      compareAtMinor: null,
      capturedAt: new Date(),
      market: "default",
      currency: "USD",
    });

    const diffs = await diffVariantPrices(1, "p1", [
      { id: 11, price: "17.99" },
    ]);

    expect(diffs[0]).toMatchObject({
      priceMinor: 1799,
      previousPriceMinor: 1999,
      changed: true,
    });
  });

  it("flags a compare-at-only change (sale started or ended)", async () => {
    mockDb.query.priceSnapshots.findFirst.mockResolvedValue({
      priceMinor: 1999,
      compareAtMinor: null,
      capturedAt: new Date(),
      market: "default",
      currency: "USD",
    });

    const diffs = await diffVariantPrices(1, "p1", [
      { id: 11, price: "19.99", compare_at_price: "24.99" },
    ]);

    expect(diffs[0]).toMatchObject({
      compareAtMinor: 2499,
      previousCompareAtMinor: null,
      changed: true,
    });
  });

  it("treats null/empty compare-at as cleared", async () => {
    mockDb.query.priceSnapshots.findFirst.mockResolvedValue({
      priceMinor: 1999,
      compareAtMinor: 2499,
      capturedAt: new Date(),
      market: "default",
      currency: "USD",
    });

    const diffs = await diffVariantPrices(1, "p1", [
      { id: 11, price: "19.99", compare_at_price: null },
    ]);

    expect(diffs[0]).toMatchObject({
      compareAtMinor: null,
      previousCompareAtMinor: 2499,
      changed: true,
    });
  });

  it("drops variants with unparseable prices", async () => {
    mockDb.query.priceSnapshots.findFirst.mockResolvedValue(undefined);

    const diffs = await diffVariantPrices(1, "p1", [
      { id: 11, price: "not-a-price" },
      { id: 12, price: "9.99" },
    ]);

    expect(diffs.map((d) => d.variantId)).toEqual(["12"]);
  });
});

describe("recordSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts an append-only row with market/currency/source", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 7 }]);
    mockDb.insert.mockReturnValue({ values: vi.fn().mockReturnValue({ returning }) });

    const row = await recordSnapshot({
      shopId: 1,
      productId: "p1",
      variantId: "11",
      market: "DE",
      currency: "EUR",
      priceMinor: 1999,
      compareAtMinor: null,
      source: "webhook",
    });

    expect(row).toEqual({ id: 7 });
    const values = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(values).toMatchObject({
      shopId: 1,
      productId: "p1",
      variantId: "11",
      market: "DE",
      currency: "EUR",
      priceMinor: 1999,
      compareAtMinor: null,
      source: "webhook",
    });
    expect(values.capturedAt).toBeInstanceOf(Date);
  });
});

describe("snapshotsForVariant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps rows to price points newest-first", async () => {
    const newer = new Date("2026-11-19T10:00:00Z");
    const older = new Date("2026-11-18T10:00:00Z");
    mockDb.query.priceSnapshots.findMany.mockResolvedValue([
      { priceMinor: 1799, capturedAt: newer, market: "default", currency: "USD" },
      { priceMinor: 1999, capturedAt: older, market: "default", currency: "USD" },
    ]);

    const points = await snapshotsForVariant(1, "p1", "11");

    expect(points).toEqual([
      { priceMinor: 1799, capturedAt: newer, market: "default", currency: "USD" },
      { priceMinor: 1999, capturedAt: older, market: "default", currency: "USD" },
    ]);
  });
});

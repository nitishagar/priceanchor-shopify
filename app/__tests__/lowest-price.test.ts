import { describe, it, expect } from "vitest";
import {
  CA_LOOKBACK_DAYS,
  EU_LOOKBACK_DAYS,
  caFormerPriceHeuristic,
  compareAtSince,
  discountFromPrior,
  euPriorPrice,
  euPriorPricePerMarket,
  lastObservedAt,
  lowestInWindow,
  parsePriceToMinor,
  type PricePoint,
} from "../services/lowest-price.server";

const AS_OF = new Date("2026-11-19T12:00:00.000Z");
const daysAgo = (n: number) => new Date(AS_OF.getTime() - n * 24 * 60 * 60 * 1000);
const pt = (priceMinor: number, days: number, market = "default"): PricePoint => ({
  priceMinor,
  capturedAt: daysAgo(days),
  market,
  currency: "EUR",
});

describe("lowestInWindow", () => {
  it("returns the minimum inside the window", () => {
    const r = lowestInWindow(
      [pt(1999, 1), pt(1499, 10), pt(1799, 20)],
      30,
      AS_OF,
    );
    expect(r.lowestMinor).toBe(1499);
    expect(r.snapshotCount).toBe(3);
    expect(r.windowDays).toBe(30);
  });

  it("ignores snapshots older than the window", () => {
    const r = lowestInWindow([pt(999, 45), pt(1499, 10)], 30, AS_OF);
    expect(r.lowestMinor).toBe(1499);
    expect(r.snapshotCount).toBe(1);
  });

  it("ignores future snapshots", () => {
    const future: PricePoint = {
      priceMinor: 1,
      capturedAt: new Date(AS_OF.getTime() + 60 * 1000),
    };
    const r = lowestInWindow([future, pt(1499, 2)], 30, AS_OF);
    expect(r.lowestMinor).toBe(1499);
    expect(r.snapshotCount).toBe(1);
  });

  it("returns null when the window is empty", () => {
    const r = lowestInWindow([pt(999, 45)], 30, AS_OF);
    expect(r.lowestMinor).toBeNull();
    expect(r.snapshotCount).toBe(0);
  });

  it("includes snapshots exactly on the window boundary", () => {
    const r = lowestInWindow([pt(1299, 30)], 30, AS_OF);
    expect(r.lowestMinor).toBe(1299);
    expect(r.snapshotCount).toBe(1);
  });
});

describe("euPriorPrice", () => {
  it("uses the 30-day Omnibus window", () => {
    expect(EU_LOOKBACK_DAYS).toBe(30);
    const r = euPriorPrice([pt(1999, 5), pt(999, 31)], AS_OF);
    // 31-day-old low is outside the EU window.
    expect(r.lowestMinor).toBe(1999);
    expect(r.windowDays).toBe(30);
  });
});

describe("euPriorPricePerMarket", () => {
  it("keeps a separate history per market", () => {
    const out = euPriorPricePerMarket(
      [pt(1999, 5, "DE"), pt(999, 5, "FR"), pt(1799, 2, "DE")],
      AS_OF,
    );
    // A French price drop must not set the German reference price.
    expect(out["DE"]!.lowestMinor).toBe(1799);
    expect(out["FR"]!.lowestMinor).toBe(999);
  });
});

describe("caFormerPriceHeuristic", () => {
  it("uses a 90-day window over merchant history", () => {
    expect(CA_LOOKBACK_DAYS).toBe(90);
    const r = caFormerPriceHeuristic([pt(1999, 5), pt(999, 60)], AS_OF);
    expect(r.lowestMinor).toBe(999);
    expect(r.windowDays).toBe(90);
  });

  it("excludes history older than 90 days", () => {
    const r = caFormerPriceHeuristic([pt(999, 95), pt(1999, 5)], AS_OF);
    expect(r.lowestMinor).toBe(1999);
  });
});

describe("discountFromPrior (Aldi rule)", () => {
  it("computes % off from the prior price", () => {
    const r = discountFromPrior(1499, 1999);
    expect(r.percentOff).toBeCloseTo(25, 1);
  });

  it("returns null when there is no reduction", () => {
    expect(discountFromPrior(1999, 1999).percentOff).toBeNull();
    expect(discountFromPrior(2199, 1999).percentOff).toBeNull();
  });

  it("returns null without a prior price", () => {
    expect(discountFromPrior(1499, null).percentOff).toBeNull();
    expect(discountFromPrior(1499, 0).percentOff).toBeNull();
  });
});

describe("parsePriceToMinor", () => {
  it("parses Shopify price strings to cents", () => {
    expect(parsePriceToMinor("19.99")).toBe(1999);
    expect(parsePriceToMinor("19.9")).toBe(1990);
    expect(parsePriceToMinor(19.99)).toBe(1999);
  });

  it("returns null for missing or invalid prices", () => {
    expect(parsePriceToMinor(null)).toBeNull();
    expect(parsePriceToMinor(undefined)).toBeNull();
    expect(parsePriceToMinor("")).toBeNull();
    expect(parsePriceToMinor("abc")).toBeNull();
    expect(parsePriceToMinor("-5")).toBeNull();
  });
});

describe("compareAtSince", () => {
  const withCompareAt = (
    priceMinor: number,
    days: number,
    compareAtMinor: number | null,
  ): PricePoint => ({ ...pt(priceMinor, days), compareAtMinor });

  it("returns the oldest observation of the trailing compare-at run", () => {
    const history = [
      withCompareAt(1499, 1, 2499),
      withCompareAt(1599, 40, 2499),
      withCompareAt(1699, 80, 2499),
      withCompareAt(1699, 100, 1999),
    ];
    expect(compareAtSince(history, 2499)).toEqual(daysAgo(80));
  });

  it("is order-agnostic", () => {
    const history = [
      withCompareAt(1699, 100, 1999),
      withCompareAt(1499, 1, 2499),
      withCompareAt(1599, 40, 2499),
    ];
    expect(compareAtSince(history, 2499)).toEqual(daysAgo(40));
  });

  it("returns null for null compare-at or a missing value", () => {
    const history = [withCompareAt(1499, 1, 2499)];
    expect(compareAtSince(history, null)).toBeNull();
    expect(compareAtSince(history, 9999)).toBeNull();
    expect(compareAtSince([], 2499)).toBeNull();
  });
});

describe("lastObservedAt", () => {
  it("returns the most recent observation of the price", () => {
    const history = [pt(1999, 20), pt(1499, 10), pt(1999, 5)];
    expect(lastObservedAt(history, 1999)).toEqual(daysAgo(5));
    expect(lastObservedAt(history, 1499)).toEqual(daysAgo(10));
  });

  it("returns null when the price was never observed", () => {
    expect(lastObservedAt([pt(1499, 1)], 1999)).toBeNull();
    expect(lastObservedAt([], 1999)).toBeNull();
  });
});

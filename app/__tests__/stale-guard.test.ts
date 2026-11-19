import { describe, it, expect } from "vitest";
import {
  classifyStale,
  DEFAULT_STALE_THRESHOLDS,
  findStaleSales,
} from "../services/stale-guard.server";

describe("DEFAULT_STALE_THRESHOLDS", () => {
  it("warns at 60d, reviews at 75d, goes stale at 90d", () => {
    expect(DEFAULT_STALE_THRESHOLDS).toEqual({
      warnDays: 60,
      reviewDays: 75,
      staleDays: 90,
    });
  });
});

describe("classifyStale", () => {
  it("treats missing compare-at as fresh", () => {
    expect(classifyStale(120, null)).toBe("fresh");
    expect(classifyStale(null, 2499)).toBe("fresh");
  });

  it("classifies by age tier", () => {
    expect(classifyStale(10, 2499)).toBe("fresh");
    expect(classifyStale(59, 2499)).toBe("fresh");
    expect(classifyStale(60, 2499)).toBe("warn");
    expect(classifyStale(74, 2499)).toBe("warn");
    expect(classifyStale(75, 2499)).toBe("review");
    expect(classifyStale(89, 2499)).toBe("review");
    expect(classifyStale(90, 2499)).toBe("stale");
    expect(classifyStale(400, 2499)).toBe("stale");
  });

  it("honours custom per-shop thresholds", () => {
    const t = { warnDays: 30, reviewDays: 45, staleDays: 60 };
    expect(classifyStale(30, 2499, t)).toBe("warn");
    expect(classifyStale(60, 2499, t)).toBe("stale");
  });
});

describe("findStaleSales", () => {
  const AS_OF = new Date("2026-11-19T12:00:00.000Z");
  const daysAgo = (n: number) =>
    new Date(AS_OF.getTime() - n * 24 * 60 * 60 * 1000);

  it("computes age from compareAtSince and classifies", () => {
    const findings = findStaleSales(
      [
        { productId: "p1", variantId: "11", compareAtMinor: 2499, compareAtSince: daysAgo(100) },
        { productId: "p2", variantId: "21", compareAtMinor: 2499, compareAtSince: daysAgo(70) },
        { productId: "p3", variantId: "31", compareAtMinor: null, compareAtSince: null },
      ],
      AS_OF,
    );

    expect(findings[0]).toMatchObject({ status: "stale", ageDays: 100 });
    expect(findings[1]).toMatchObject({ status: "warn", ageDays: 70 });
    expect(findings[2]).toMatchObject({ status: "fresh", ageDays: null });
  });
});

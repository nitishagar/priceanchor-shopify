import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  query: {
    shops: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../db.server", () => ({ getDb: () => mockDb }));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

import {
  PLAN_LIMITS,
  checkPlanAllowsProduct,
  getPlanCapabilities,
  getPlanLimits,
} from "../services/plan-enforcer.server";

describe("PLAN_LIMITS", () => {
  it("gates tracked products 25 / 250 / unlimited across tiers", () => {
    expect(PLAN_LIMITS.free.productLimit).toBe(25);
    expect(PLAN_LIMITS.standard.productLimit).toBe(250);
    expect(PLAN_LIMITS.unlimited.productLimit).toBe(Infinity);
  });

  it("reserves CSV export and the stale guard for paid tiers", () => {
    expect(PLAN_LIMITS.free.exportCsv).toBe(false);
    expect(PLAN_LIMITS.standard.exportCsv).toBe(true);
    expect(PLAN_LIMITS.free.staleGuard).toBe(false);
    expect(PLAN_LIMITS.standard.staleGuard).toBe(true);
    expect(PLAN_LIMITS.free.prioritySupport).toBe(false);
    expect(PLAN_LIMITS.unlimited.prioritySupport).toBe(true);
  });

  it("reserves PDF export and auto-clear for Unlimited", () => {
    expect(PLAN_LIMITS.free.exportPdf).toBe(false);
    expect(PLAN_LIMITS.standard.exportPdf).toBe(false);
    expect(PLAN_LIMITS.unlimited.exportPdf).toBe(true);
    expect(PLAN_LIMITS.free.autoClear).toBe(false);
    expect(PLAN_LIMITS.standard.autoClear).toBe(false);
    expect(PLAN_LIMITS.unlimited.autoClear).toBe(true);
  });
});

describe("checkPlanAllowsProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows products under the limit", async () => {
    mockDb.query.shops.findFirst.mockResolvedValue({
      id: 1,
      plan: "free",
      trackedCount: 24,
    });

    const result = await checkPlanAllowsProduct(1, mockDb as never, 1);

    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(24);
    expect(result.limit).toBe(25);
  });

  it("denies products that would exceed the limit", async () => {
    mockDb.query.shops.findFirst.mockResolvedValue({
      id: 1,
      plan: "free",
      trackedCount: 25,
    });

    const result = await checkPlanAllowsProduct(1, mockDb as never, 1);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("25/25");
    expect(result.reason).toContain("tracked products");
  });

  it("accounts for bulk additions", async () => {
    mockDb.query.shops.findFirst.mockResolvedValue({
      id: 1,
      plan: "standard",
      trackedCount: 249,
    });

    expect((await checkPlanAllowsProduct(1, mockDb as never, 1)).allowed).toBe(true);
    expect((await checkPlanAllowsProduct(1, mockDb as never, 2)).allowed).toBe(false);
  });

  it("always allows on unlimited", async () => {
    mockDb.query.shops.findFirst.mockResolvedValue({
      id: 1,
      plan: "unlimited",
      trackedCount: 99999,
    });

    const result = await checkPlanAllowsProduct(1, mockDb as never, 5000);

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(Infinity);
  });

  it("denies unknown shops", async () => {
    mockDb.query.shops.findFirst.mockResolvedValue(undefined);

    const result = await checkPlanAllowsProduct(999, mockDb as never, 1);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Shop not found");
  });

  it("treats missing trackedCount as zero", async () => {
    mockDb.query.shops.findFirst.mockResolvedValue({
      id: 1,
      plan: "free",
      trackedCount: null,
    });

    const result = await checkPlanAllowsProduct(1, mockDb as never, 1);

    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(0);
  });
});

describe("getPlanLimits / getPlanCapabilities", () => {
  it("falls back to free for unknown plans", () => {
    expect(getPlanLimits("enterprise" as never)).toBe(PLAN_LIMITS.free);
    expect(getPlanCapabilities("enterprise" as never)).toBe(PLAN_LIMITS.free);
  });
});

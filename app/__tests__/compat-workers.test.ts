import { describe, it, expect, vi } from "vitest";
import { handleProductPriceCapture } from "../services/price-webhook.server";

// I17: concurrent captures must collect-not-throw with consistent accounting.
// NOTE on the race itself: two racing CHANGED deliveries for one variant may
// double-insert (no unique constraint, no cross-isolate serialization
// possible) — documented, not widened by migration (Lambda also runs
// concurrent instances). Asserting exact row counts would be flaky-or-vacuous,
// so this suite asserts the deterministic part: N parallel captures complete
// with N total outcomes and errors in-band, never thrown.
describe("concurrent capture accounting", () => {
  it("completes N parallel captures with consistent totals", async () => {
    const mockDb = {
      query: {
        priceSnapshots: {
          findFirst: vi.fn().mockResolvedValue({
            priceMinor: 1999,
            compareAtMinor: null,
            capturedAt: new Date(),
            market: "default",
            currency: "USD",
          }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        shops: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
      },
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 7 }]),
        })),
      })),
      selectDistinct: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ productId: "p1" }]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      })),
    };
    // Even ids repeat the stored price (skip path); odd ids differ (record path).
    const payload = (i: number) => ({
      id: 1000 + i,
      variants: [{ id: (1000 + i) * 10 + 1, price: i % 2 === 0 ? "19.99" : "17.99" }],
    });
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        handleProductPriceCapture(
          "s.myshopify.com",
          null,
          payload(i),
          mockDb as never,
        ),
      ),
    );
    const totals = results.reduce(
      (acc, r) => ({
        recorded: acc.recorded + r.recorded,
        skipped: acc.skipped + r.skippedUnchanged,
      }),
      { recorded: 0, skipped: 0 },
    );
    expect(totals.recorded).toBe(5);
    expect(totals.skipped).toBe(5);
    expect(totals.recorded + totals.skipped).toBe(10);
    for (const r of results) {
      expect(Array.isArray(r.metafieldErrors)).toBe(true);
      expect(Array.isArray(r.autoClearErrors)).toBe(true);
    }
  });
});

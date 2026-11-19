import { describe, it, expect } from "vitest";
import { mapShopifySubscriptionToPlan } from "../services/billing/plan-mapping";

describe("mapShopifySubscriptionToPlan", () => {
  it("maps paid plan names case-insensitively", () => {
    expect(mapShopifySubscriptionToPlan("Standard")).toBe("standard");
    expect(mapShopifySubscriptionToPlan("STANDARD (ANNUAL)")).toBe("standard");
    expect(mapShopifySubscriptionToPlan("Unlimited")).toBe("unlimited");
    expect(mapShopifySubscriptionToPlan("unlimited (annual)")).toBe(
      "unlimited",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(mapShopifySubscriptionToPlan("  Standard  ")).toBe("standard");
  });

  it("falls back to free for missing, blank, or unknown names", () => {
    expect(mapShopifySubscriptionToPlan(null)).toBe("free");
    expect(mapShopifySubscriptionToPlan(undefined)).toBe("free");
    expect(mapShopifySubscriptionToPlan("")).toBe("free");
    expect(mapShopifySubscriptionToPlan("   ")).toBe("free");
    expect(mapShopifySubscriptionToPlan("Growth")).toBe("free");
    expect(mapShopifySubscriptionToPlan("Standard Plus")).toBe("free");
  });
});

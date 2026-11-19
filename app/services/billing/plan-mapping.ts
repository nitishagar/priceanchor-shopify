import type { Plan } from "../plan-enforcer.server";

export const SHOPIFY_PLAN_NAMES: Record<Exclude<Plan, "free">, readonly string[]> = {
  standard: ["standard", "standard (annual)"],
  unlimited: ["unlimited", "unlimited (annual)"],
};

export function mapShopifySubscriptionToPlan(
  name: string | null | undefined,
): Plan {
  if (!name) return "free";
  const key = name.trim().toLowerCase();
  if (!key) return "free";

  for (const [plan, names] of Object.entries(SHOPIFY_PLAN_NAMES) as Array<
    [Exclude<Plan, "free">, readonly string[]]
  >) {
    if (names.includes(key)) return plan;
  }
  return "free";
}

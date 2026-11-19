import type { Plan } from "../plan-enforcer.server";

export function getCurrentPlan(shopRecord: { plan: string }): Plan {
  if (
    shopRecord.plan === "free" ||
    shopRecord.plan === "standard" ||
    shopRecord.plan === "unlimited"
  ) {
    return shopRecord.plan;
  }
  return "free";
}

export function managedPricingUrl(): string {
  const handle = process.env.SHOPIFY_APP_HANDLE || "priceanchor";
  return `shopify://admin/charges/${handle}/pricing_plans`;
}

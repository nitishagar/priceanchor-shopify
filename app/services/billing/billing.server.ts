import { eq } from "drizzle-orm";
import type { DbClient } from "../../db.server";
import { shops } from "../../db/schema";
import { PLAN_LIMITS, type Plan } from "../plan-enforcer.server";
import type { AdminGraphQLClient } from "../graphql-types.server";
import { mapShopifySubscriptionToPlan } from "./plan-mapping";

export { getCurrentPlan, managedPricingUrl } from "./managed-pricing";

const ACTIVE_SUBSCRIPTIONS_QUERY = `#graphql
  query CurrentSubscription {
    currentAppInstallation {
      activeSubscriptions {
        name
        status
      }
    }
  }
`;

interface ActiveSubscription {
  name: string;
  status: string;
}

interface CurrentSubscriptionResponse {
  data?: {
    currentAppInstallation?: {
      activeSubscriptions?: ActiveSubscription[];
    };
  };
}

export async function syncPlanFromShopify(
  shopDomain: string,
  admin: AdminGraphQLClient,
  dbClient: DbClient,
): Promise<Plan> {
  const shopRecord = await dbClient.query.shops.findFirst({
    where: eq(shops.domain, shopDomain),
  });

  if (!shopRecord) return "free";

  let derivedPlan: Plan = "free";
  try {
    const response = await admin.graphql(ACTIVE_SUBSCRIPTIONS_QUERY);
    const json = (await response.json()) as CurrentSubscriptionResponse;
    const subs = json.data?.currentAppInstallation?.activeSubscriptions ?? [];
    const active = subs.find((s) => s.status === "ACTIVE");
    derivedPlan = mapShopifySubscriptionToPlan(active?.name);
  } catch (err) {
    console.error("syncPlanFromShopify: failed to fetch subscription", err);
    return "free";
  }

  if (shopRecord.plan === derivedPlan) return derivedPlan;

  const limit = PLAN_LIMITS[derivedPlan].productLimit;
  const productLimit = Number.isFinite(limit) ? limit : 999999;

  await dbClient
    .update(shops)
    .set({ plan: derivedPlan, productLimit })
    .where(eq(shops.id, shopRecord.id));

  return derivedPlan;
}

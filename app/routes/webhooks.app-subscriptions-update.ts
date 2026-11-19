import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { syncPlanFromShopify } from "../services/billing/billing.server";
import type { AdminGraphQLClient } from "../services/graphql-types.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, admin } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  if (admin) {
    try {
      await syncPlanFromShopify(shop, admin as unknown as AdminGraphQLClient);
    } catch (err) {
      console.error("app-subscriptions-update: sync failed", err);
    }
  }

  return new Response();
};

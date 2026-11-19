import type { ActionFunctionArgs } from "react-router";
import { getShopify } from "../shopify.server";
import { getDb } from "../db.server";
import { envFromContext } from "../lib/server-env";
import { syncPlanFromShopify } from "../services/billing/billing.server";
import type { AdminGraphQLClient } from "../services/graphql-types.server";

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const env = envFromContext(context);
  const { authenticate } = getShopify(env);
  const { shop, topic, admin } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  if (admin) {
    try {
      await syncPlanFromShopify(
        shop,
        admin as unknown as AdminGraphQLClient,
        getDb(env.DATABASE_URL),
      );
    } catch (err) {
      console.error("app-subscriptions-update: sync failed", err);
    }
  }

  return new Response();
};

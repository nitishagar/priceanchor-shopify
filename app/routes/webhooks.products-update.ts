import type { ActionFunctionArgs } from "react-router";
import { getShopify } from "../shopify.server";
import { getDb } from "../db.server";
import { envFromContext } from "../lib/server-env";
import {
  handleProductPriceCapture,
  type ProductWebhookPayload,
} from "../services/price-webhook.server";
import type { AdminGraphQLClient } from "../services/graphql-types.server";

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const env = envFromContext(context);
  const { authenticate } = getShopify(env);
  const { shop, admin, payload } = await authenticate.webhook(request);

  try {
    // NOTE: products/update fires on ANY product edit (title, tags,
    // inventory), not price-only. handleProductPriceCapture diffs payload
    // prices against the latest snapshots and records rows only when a
    // price or compare-at actually changed.
    const product = payload as unknown as ProductWebhookPayload;
    const result = await handleProductPriceCapture(
      shop,
      (admin as unknown as AdminGraphQLClient) ?? null,
      product,
      getDb(env.DATABASE_URL),
    );
    console.log(
      `[products/update] shop=${shop} product=${product.id} recorded=${result.recorded} unchanged=${result.skippedUnchanged}`,
    );
    return new Response();
  } catch (error) {
    console.error("[products/update] Unhandled error processing webhook:", error);
    return new Response();
  }
};

import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  handleProductPriceCapture,
  type ProductWebhookPayload,
} from "../services/price-webhook.server";
import type { AdminGraphQLClient } from "../services/graphql-types.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, admin, payload } = await authenticate.webhook(request);

  try {
    const product = payload as unknown as ProductWebhookPayload;
    const result = await handleProductPriceCapture(
      shop,
      (admin as unknown as AdminGraphQLClient) ?? null,
      product,
    );
    console.log(
      `[products/create] shop=${shop} product=${product.id} recorded=${result.recorded} unchanged=${result.skippedUnchanged}`,
    );
    return new Response();
  } catch (error) {
    console.error("[products/create] Unhandled error processing webhook:", error);
    return new Response();
  }
};

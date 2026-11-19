import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { handleProductDelete } from "../services/price-webhook.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  try {
    const product = payload as unknown as { id: number | string };
    await handleProductDelete(shop, product.id);
    console.log(`[products/delete] shop=${shop} product=${product.id}`);
    return new Response();
  } catch (error) {
    console.error("[products/delete] Unhandled error processing webhook:", error);
    return new Response();
  }
};

import type { ActionFunctionArgs } from "react-router";
import { getShopify } from "../shopify.server";
import { getDb } from "../db.server";
import { envFromContext } from "../lib/server-env";
import { handleProductDelete } from "../services/price-webhook.server";

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const env = envFromContext(context);
  const { authenticate } = getShopify(env);
  const { shop, payload } = await authenticate.webhook(request);

  try {
    const product = payload as unknown as { id: number | string };
    await handleProductDelete(shop, product.id, getDb(env.DATABASE_URL));
    console.log(`[products/delete] shop=${shop} product=${product.id}`);
    return new Response();
  } catch (error) {
    console.error("[products/delete] Unhandled error processing webhook:", error);
    return new Response();
  }
};

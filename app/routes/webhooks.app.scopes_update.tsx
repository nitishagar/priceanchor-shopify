import type { ActionFunctionArgs } from "react-router";
import { getShopify } from "../shopify.server";
import { envFromContext } from "../lib/server-env";

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const env = envFromContext(context);
  const { authenticate } = getShopify(env);
  const { topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  // Session scope updates are handled automatically by the session storage adapter
  return new Response();
};

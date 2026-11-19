import type { ActionFunctionArgs } from "react-router";
import { getShopify } from "../shopify.server";
import { envFromContext } from "../lib/server-env";

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const env = envFromContext(context);
  const { authenticate, sessionStorage } = getShopify(env);
  const { shop, session, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await sessionStorage.deleteSessions([session.id]);
  }

  return new Response();
};

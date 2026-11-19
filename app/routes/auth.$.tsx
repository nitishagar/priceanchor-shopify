
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { getShopify } from "../shopify.server";
import { envFromContext } from "../lib/server-env";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const env = envFromContext(context);
  const { authenticate } = getShopify(env);
  await authenticate.admin(request);

  return null;
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

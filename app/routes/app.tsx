import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";

import { getShopify } from "../shopify.server";
import { getDb } from "../db.server";
import { envFromContext } from "../lib/server-env";
import { syncPlanFromShopify } from "../services/billing/billing.server";
import type { AdminGraphQLClient } from "../services/graphql-types.server";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const env = envFromContext(context);
  const { authenticate } = getShopify(env);
  const { session, admin } = await authenticate.admin(request);

  if (admin) {
    try {
      await syncPlanFromShopify(
        session.shop,
        admin as unknown as AdminGraphQLClient,
        getDb(env.DATABASE_URL),
      );
    } catch (err) {
      console.error("app loader: plan sync failed", err);
    }
  }

  return { apiKey: env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <NavMenu>
        <a href="/app" rel="home">
          Dashboard
        </a>
        <a href="/app/products">Products</a>
        <a href="/app/settings">Settings</a>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

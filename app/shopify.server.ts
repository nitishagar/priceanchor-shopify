import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { DrizzleSessionStoragePostgres } from "@shopify/shopify-app-session-storage-drizzle";
import { getDb } from "./db.server";
import { sessionTable } from "./db/schema";
import { getOrCreateShop } from "./services/shop.server";
import { syncPlanFromShopify } from "./services/billing/billing.server";
import type { AdminGraphQLClient } from "./services/graphql-types.server";
import type { ServerEnv } from "./lib/server-env";

function envKey(env: ServerEnv): string {
  // JSON (not separator-less join): adjacent-field collisions such as
  // {KEY:"ab",SECRET:"c"} vs {KEY:"a",SECRET:"bc"} must key differently.
  return JSON.stringify([
    env.SHOPIFY_API_KEY,
    env.SHOPIFY_API_SECRET,
    env.SCOPES,
    env.SHOPIFY_APP_URL,
    env.SHOP_CUSTOM_DOMAIN,
    env.DATABASE_URL,
  ]);
}

// Single-entry cache (see db.server.ts): one deployment has one env.
let cached: { key: string; shopify: ReturnType<typeof buildShopify> } | null =
  null;

function buildShopify(env: ServerEnv) {
  const dbClient = getDb(env.DATABASE_URL);
  return shopifyApp({
    apiKey: env.SHOPIFY_API_KEY,
    apiSecretKey: env.SHOPIFY_API_SECRET || "",
    apiVersion: ApiVersion.April26,
    scopes: env.SCOPES?.split(","),
    appUrl: env.SHOPIFY_APP_URL || "",
    authPathPrefix: "/auth",
    sessionStorage: new DrizzleSessionStoragePostgres(dbClient, sessionTable),
    distribution: AppDistribution.AppStore,
    future: {
      expiringOfflineAccessTokens: true,
    },
    hooks: {
      afterAuth: async ({ session, admin }) => {
        if (!admin) return;

        const shopRecord = await getOrCreateShop(
          session.shop,
          getDb(env.DATABASE_URL),
        );

        if (shopRecord) {
          await syncPlanFromShopify(
            session.shop,
            admin as unknown as AdminGraphQLClient,
            getDb(env.DATABASE_URL),
          );
        }
      },
    },
    ...(env.SHOP_CUSTOM_DOMAIN
      ? { customShopDomains: [env.SHOP_CUSTOM_DOMAIN] }
      : {}),
  });
}

export function getShopify(env: ServerEnv) {
  const key = envKey(env);
  if (!cached || cached.key !== key) {
    cached = { key, shopify: buildShopify(env) };
  }
  return cached.shopify;
}

export const apiVersion = ApiVersion.April26;
export type ShopifyApp = ReturnType<typeof getShopify>;

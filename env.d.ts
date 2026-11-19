/// <reference types="vite/client" />
/// <reference types="@react-router/node" />
/// <reference types="@cloudflare/workers-types" />

// Worker env bindings (see wrangler.jsonc vars + secrets). Declared here
// because @cloudflare/workers-types exposes Env only as Cloudflare.Env.
interface Env {
  DATABASE_URL: string;
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  CRON_SECRET: string;
  SCOPES: string;
  SHOPIFY_APP_URL: string;
  SHOP_CUSTOM_DOMAIN?: string;
  SHOPIFY_APP_HANDLE?: string;
}

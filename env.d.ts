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

// Build-output alias for the Worker entry: resolves at typecheck time even
// on fresh clones where dist/ doesn't exist yet (esbuild resolves the same
// alias to the real file at deploy time, after `npm run build`).
declare module "@priceanchor/server-build" {
  const routes: unknown;
  const entry: unknown;
}

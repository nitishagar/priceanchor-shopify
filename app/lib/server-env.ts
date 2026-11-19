// Request-scoped environment bridge (Workers + dev/test).
//
// Workers have no process.env: production env arrives via the React Router
// load context (`context.cloudflare.env`, provided by workers/app.ts — see
// S3). Local dev (`shopify app dev`) and vitest provide no cloudflare
// context, so this module falls back to process.env — identical behavior to
// before on those runtimes. Every server module reads env ONLY through here.

declare module "react-router" {
  interface AppLoadContext {
    cloudflare: {
      env: Record<string, string | undefined>;
      ctx: ExecutionContext;
    };
  }
}

export interface ServerEnv {
  DATABASE_URL?: string;
  SHOPIFY_API_KEY?: string;
  SHOPIFY_API_SECRET?: string;
  SCOPES?: string;
  SHOPIFY_APP_URL?: string;
  SHOP_CUSTOM_DOMAIN?: string;
  SHOPIFY_APP_HANDLE?: string;
  CRON_SECRET?: string;
}

export function envFromContext(context?: unknown): ServerEnv {
  const cloudflare = (
    context as {
      cloudflare?: { env?: Record<string, string | undefined> };
    } | null
    | undefined
  )?.cloudflare;
  if (cloudflare?.env) return { ...cloudflare.env };
  if (typeof process !== "undefined" && process.env) {
    return { ...(process.env as unknown as ServerEnv) };
  }
  throw new Error(
    "PriceAnchor: no Worker env in load context and no process.env fallback",
  );
}

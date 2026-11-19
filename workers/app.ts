import { createRequestHandler } from "react-router";

const requestHandler = createRequestHandler(
  // Virtual module provided by @react-router/dev at build time.
  // eslint-disable-next-line import/no-unresolved
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

// Deviation from the cf-ref template (which passes NO context): every
// PriceAnchor route reads env from `context.cloudflare.env` (see
// app/lib/server-env.ts), so the entry MUST pass it. Without this, all
// env reads fail on Workers.
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return requestHandler(request, {
      cloudflare: {
        env: env as unknown as Record<string, string | undefined>,
        ctx,
      },
    });
  },
} satisfies ExportedHandler<Env>;

import { createRequestHandler, type ServerBuild } from "react-router";
// Alias to the built server manifest (see tsconfig paths + env.d.ts ambient
// declaration). @react-router/dev v7 provides NO Vite-built worker entry, so
// a dedicated worker build (vite.worker.config.ts) bundles this file against
// the react-router build output. Deploy order: npm run build, then deploy.
// eslint-disable-next-line import/no-unresolved -- build output exists only post-build; bundlers resolve via tsconfig paths
import * as serverBuild from "@priceanchor/server-build";

const requestHandler = createRequestHandler(
  serverBuild as unknown as ServerBuild,
  import.meta.env?.MODE ?? "production",
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

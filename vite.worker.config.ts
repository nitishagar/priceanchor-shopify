import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Worker bundle build (phase 2 of `npm run build`, after `react-router
// build` emits build/client + build/server). Bundles workers/app.ts — which
// imports the built server manifest via the @priceanchor/server-build alias
// — into a single build/worker/index.js that wrangler deploys verbatim.
//
// SSR-shaped (not lib): dependencies are bundled in, while Node builtins
// stay as `node:` imports served by the Workers nodejs_compat runtime.
// react-dom/server is pinned to the node build (the browser build lacks
// renderToPipeableStream, which entry.server requires).
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: [
      {
        find: /^react-dom\/server$/,
        replacement: "react-dom/server.node",
      },
    ],
  },
  ssr: {
    noExternal: true,
  },
  build: {
    ssr: "workers/app.ts",
    outDir: "build/worker",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      output: {
        format: "esm",
        entryFileNames: "index.js",
      },
    },
  },
});

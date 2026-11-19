import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // packages/site has its own node:test suite (npm test in that dir).
    exclude: ["node_modules", "dist", "build", "packages/**"],
    environment: "jsdom",
    globals: true,
    setupFiles: [],
    env: {
      DATABASE_URL: "postgresql://test:test@localhost/test",
    },
  },
});

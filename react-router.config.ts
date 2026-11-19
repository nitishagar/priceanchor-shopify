import type { Config } from "@react-router/dev/config";

export default {
  // Server-side render by default; required for the Workers fetch entry.
  ssr: true,
  // The Cloudflare Vite plugin redirects build output to dist/; the server
  // manifest loader must look there too (else ENOENT on build manifest).
  buildDirectory: "dist",
} satisfies Config;

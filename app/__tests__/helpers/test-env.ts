// Test-only load-context builder. Reads live process.env AT CALL TIME so
// tests that mutate env per test (e.g. CRON_SECRET 500/401 cases) observe
// their mutations — never construct once at import.
import type { ServerEnv } from "../../lib/server-env";

export function testEnv(): ServerEnv {
  return { ...(process.env as unknown as ServerEnv) };
}

export function testContext() {
  return { cloudflare: { env: testEnv() } };
}

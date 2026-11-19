import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./db/schema";

// Single-entry cache: one deployment has one env, so at most one client
// exists in production. Rebuilds if the values ever differ (tests), which
// also keeps sequential overlapping test envs correct — handles are captured
// at call time, never re-read from the cache mid-request.
let cached: {
  connectionString: string;
  db: ReturnType<typeof buildDb>;
} | null = null;

function buildDb(connectionString: string) {
  return drizzle(neon(connectionString), { schema });
}

export function getDb(connectionString: string | undefined) {
  if (!connectionString) {
    throw new Error(
      "PriceAnchor: DATABASE_URL is required (Worker secret or env)",
    );
  }
  if (!cached || cached.connectionString !== connectionString) {
    cached = { connectionString, db: buildDb(connectionString) };
  }
  return cached.db;
}

export type DbClient = ReturnType<typeof getDb>;

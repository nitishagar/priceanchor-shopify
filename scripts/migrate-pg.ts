import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_FOLDER = "./drizzle";

async function baselineIfNeeded(pool: Pool) {
  const { rows: existing } = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM information_schema.tables WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'",
  );
  if (existing[0]?.count === "0") return;

  const { rows: applied } = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM drizzle.__drizzle_migrations",
  );
  if (applied[0]?.count !== "0") return;

  const { rows: hasAppTable } = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'price_snapshots'",
  );
  if (hasAppTable[0]?.count === "0") return;

  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_FOLDER, "meta/_journal.json"), "utf8"),
  ) as { entries: { tag: string; when: number }[] };

  console.log(
    `Baseline: app tables exist but __drizzle_migrations is empty. Recording ${journal.entries.length} migration(s) as applied.`,
  );

  for (const entry of journal.entries) {
    const sql = readFileSync(
      join(MIGRATIONS_FOLDER, `${entry.tag}.sql`),
      "utf8",
    );
    const hash = createHash("sha256").update(sql).digest("hex");
    await pool.query(
      "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
      [hash, entry.when],
    );
    console.log(`  baselined ${entry.tag} (${hash.slice(0, 12)}…)`);
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const pool = new Pool({ connectionString: url });
  try {
    await baselineIfNeeded(pool);
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log("Migrations applied via pg driver");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

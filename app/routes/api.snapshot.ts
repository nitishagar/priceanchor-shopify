import type { ActionFunctionArgs } from "react-router";
import { timingSafeEqual } from "node:crypto";
import { getShopify } from "../shopify.server";
import { getDb } from "../db.server";
import { envFromContext } from "../lib/server-env";
import { runSnapshotForAllShops } from "../services/snapshot.server";
import type { AdminGraphQLClient } from "../services/graphql-types.server";

// POST /api/snapshot — daily backup capture for every shop.
// Auth: Authorization: Bearer $CRON_SECRET (timing-safe compare).
// Fails closed (500) when CRON_SECRET is unset.
export const action = async ({ request, context }: ActionFunctionArgs) => {
  const env = envFromContext(context);
  const { unauthenticated } = getShopify(env);
  const secret = env.CRON_SECRET ?? "";
  if (!secret) {
    return Response.json(
      { error: "snapshot job not configured" },
      { status: 500 },
    );
  }
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = Buffer.from(secret);
  const actual = Buffer.from(presented);
  const authorized =
    expected.length === actual.length &&
    expected.length > 0 &&
    timingSafeEqual(expected, actual);
  if (!authorized) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const run = await runSnapshotForAllShops(async (shop) => {
    try {
      const { admin } = await unauthenticated.admin(shop);
      if (!admin) return null;
      return admin as unknown as AdminGraphQLClient;
    } catch {
      return null;
    }
  }, getDb(env.DATABASE_URL));

  return Response.json({
    shops: run.shops,
    productsSeen: run.productsSeen,
    recorded: run.recorded,
    results: run.results.map((r) => ({
      shop: r.shop,
      productsSeen: r.productsSeen,
      recorded: r.recorded,
      errors: r.errors,
    })),
  });
};

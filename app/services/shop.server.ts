import { eq } from "drizzle-orm";
import { db, type DbClient } from "../db.server";
import { shops } from "../db/schema";

export async function getOrCreateShop(
  domain: string,
  dbClient: DbClient = db,
) {
  const existing = await dbClient.query.shops.findFirst({
    where: eq(shops.domain, domain),
  });

  if (existing) return existing;

  const [newShop] = await dbClient
    .insert(shops)
    .values({ domain, plan: "free", productLimit: 25 })
    .onConflictDoNothing({ target: shops.domain })
    .returning();

  // If onConflictDoNothing fired (concurrent insert won the race), re-query
  if (!newShop) {
    const raced = await dbClient.query.shops.findFirst({
      where: eq(shops.domain, domain),
    });
    return raced ?? null;
  }

  return newShop;
}

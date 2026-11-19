import { eq } from "drizzle-orm";
import { db, type DbClient } from "../db.server";
import { shops } from "../db/schema";

export type Plan = "free" | "standard" | "unlimited";

export interface PlanCapabilities {
  productLimit: number;
  exportCsv: boolean;
  exportPdf: boolean;
  staleGuard: boolean;
  autoClear: boolean;
  prioritySupport: boolean;
}

// Tier map (matches /pricing copy): Free 25 products, 30-day history;
// Standard $3.99: 250 products + CSV export + stale-sale flagging;
// Unlimited $5.99: unlimited + PDF export + stale-sale auto-clear.
export const PLAN_LIMITS: Record<Plan, PlanCapabilities> = {
  free: {
    productLimit: 25,
    exportCsv: false,
    exportPdf: false,
    staleGuard: false,
    autoClear: false,
    prioritySupport: false,
  },
  standard: {
    productLimit: 250,
    exportCsv: true,
    exportPdf: false,
    staleGuard: true,
    autoClear: false,
    prioritySupport: false,
  },
  unlimited: {
    productLimit: Infinity,
    exportCsv: true,
    exportPdf: true,
    staleGuard: true,
    autoClear: true,
    prioritySupport: true,
  },
};

export interface PlanCheckResult {
  allowed: boolean;
  reason?: string;
  currentCount: number;
  limit: number;
  exportCsv: boolean;
  exportPdf: boolean;
  staleGuard: boolean;
  autoClear: boolean;
  prioritySupport: boolean;
}

function denied(
  reason: string,
  currentCount: number,
  limits: PlanCapabilities,
): PlanCheckResult {
  return {
    allowed: false,
    reason,
    currentCount,
    limit: limits.productLimit,
    exportCsv: limits.exportCsv,
    exportPdf: limits.exportPdf,
    staleGuard: limits.staleGuard,
    autoClear: limits.autoClear,
    prioritySupport: limits.prioritySupport,
  };
}

// Limits count tracked PRODUCTS (not variants): a product with many variants
// counts once. This matches the Complimus-style per-product fair-use model.
export async function checkPlanAllowsProduct(
  shopId: number,
  additional = 1,
  dbClient: DbClient = db,
): Promise<PlanCheckResult> {
  const shop = await dbClient.query.shops.findFirst({
    where: eq(shops.id, shopId),
  });

  if (!shop) {
    return denied("Shop not found", 0, PLAN_LIMITS.free);
  }

  const plan = (shop.plan as Plan) ?? "free";
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const currentCount = shop.trackedCount ?? 0;

  if (
    limits.productLimit !== Infinity &&
    currentCount + additional > limits.productLimit
  ) {
    return denied(
      `Plan limit reached: ${currentCount}/${limits.productLimit} tracked products in use`,
      currentCount,
      limits,
    );
  }

  return {
    allowed: true,
    currentCount,
    limit: limits.productLimit,
    exportCsv: limits.exportCsv,
    exportPdf: limits.exportPdf,
    staleGuard: limits.staleGuard,
    autoClear: limits.autoClear,
    prioritySupport: limits.prioritySupport,
  };
}

export function getPlanLimits(plan: Plan): PlanCapabilities {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

export function getPlanCapabilities(plan: Plan): PlanCapabilities {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

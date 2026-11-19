// Client-safe shared pricing math (no .server suffix on purpose): imported by
// both route components (browser bundle) and server modules. Server-only
// modules re-export from here.


export const EU_LOOKBACK_DAYS = 30;
export const CA_LOOKBACK_DAYS = 90;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PricePoint {
  priceMinor: number;
  capturedAt: Date;
  market?: string;
  currency?: string;
  // Present when the caller mapped full snapshots (compare-at age checks).
  compareAtMinor?: number | null;
}

export interface LowestPriceResult {
  lowestMinor: number | null;
  snapshotCount: number;
  windowDays: number;
  windowStart: Date;
  asOf: Date;
}

function windowStart(asOf: Date, windowDays: number): Date {
  return new Date(asOf.getTime() - windowDays * MS_PER_DAY);
}

// Minimum price within [asOf - windowDays, asOf]. Snapshots outside the
// window (older OR in the future) are ignored. Returns null when the window
// holds no observations.
export function lowestInWindow(
  snapshots: PricePoint[],
  windowDays: number,
  asOf: Date = new Date(),
): LowestPriceResult {
  const start = windowStart(asOf, windowDays);
  let lowest: number | null = null;
  let count = 0;
  for (const s of snapshots) {
    const t = s.capturedAt.getTime();
    if (t < start.getTime() || t > asOf.getTime()) continue;
    count += 1;
    if (lowest === null || s.priceMinor < lowest) lowest = s.priceMinor;
  }
  return { lowestMinor: lowest, snapshotCount: count, windowDays, windowStart: start, asOf };
}

// EU Omnibus Art 6a prior price: 30-day minimum for one market.
export function euPriorPrice(
  snapshots: PricePoint[],
  asOf: Date = new Date(),
): LowestPriceResult {
  return lowestInWindow(snapshots, EU_LOOKBACK_DAYS, asOf);
}

// Group snapshots by market key, then compute the EU prior price per market.
// Each market/currency shown to consumers has its own history.
export function euPriorPricePerMarket(
  snapshots: PricePoint[],
  asOf: Date = new Date(),
): Record<string, LowestPriceResult> {
  const byMarket = new Map<string, PricePoint[]>();
  for (const s of snapshots) {
    const key = s.market ?? "default";
    const list = byMarket.get(key) ?? [];
    list.push(s);
    byMarket.set(key, list);
  }
  const out: Record<string, LowestPriceResult> = {};
  for (const [market, list] of byMarket) {
    out[market] = euPriorPrice(list, asOf);
  }
  return out;
}

// CA B&P 17501 heuristic: 90-day minimum of the merchant's own history.
// Callers MUST surface the date-disclosure exception separately: when the
// merchant clearly states the date the former price prevailed, the 90-day
// rule does not apply.
export function caFormerPriceHeuristic(
  snapshots: PricePoint[],
  asOf: Date = new Date(),
): LowestPriceResult {
  return lowestInWindow(snapshots, CA_LOOKBACK_DAYS, asOf);
}

export interface DiscountResult {
  percentOff: number | null;
  priorMinor: number | null;
  currentMinor: number;
}

// Aldi rule: % off is computed from the 30-day prior price, never from the
// live compare_at_price. Returns percentOff null when no reduction applies
// (no prior, or current >= prior). Rounded to one decimal.
export function discountFromPrior(
  currentMinor: number,
  priorMinor: number | null,
): DiscountResult {
  if (priorMinor === null || priorMinor <= 0 || currentMinor >= priorMinor) {
    return { percentOff: null, priorMinor, currentMinor };
  }
  const percentOff = Math.round(((priorMinor - currentMinor) / priorMinor) * 1000) / 10;
  return { percentOff, priorMinor, currentMinor };
}

// Parse Shopify REST price strings ("19.99") to minor units. Returns null for
// missing/unparseable values instead of throwing.
export function parsePriceToMinor(price: unknown): number | null {
  if (price === null || price === undefined) return null;
  if (typeof price === "string" && price.trim() === "") return null;
  const n = typeof price === "number" ? price : Number(String(price).trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

// Oldest capturedAt of the trailing run of snapshots carrying the same
// compare-at value (order-agnostic). Returns null when the current
// compare-at is null or no snapshot carries it. Used to age compare-at
// anchors for the stale-sale guard.
export function compareAtSince(
  snapshots: PricePoint[],
  currentCompareAtMinor: number | null,
): Date | null {
  if (currentCompareAtMinor === null) return null;
  const ordered = [...snapshots].sort(
    (a, b) => b.capturedAt.getTime() - a.capturedAt.getTime(),
  );
  let since: Date | null = null;
  for (const s of ordered) {
    if ((s.compareAtMinor ?? null) !== currentCompareAtMinor) break;
    since = s.capturedAt;
  }
  return since;
}

// Most recent capturedAt at which `priceMinor` was observed, or null when
// never observed. Powers the US "Previously $X — last offered <Mon YYYY>"
// framing (CA B&P 17501 date-disclosure exception).
export function lastObservedAt(
  snapshots: PricePoint[],
  priceMinor: number,
): Date | null {
  let latest: Date | null = null;
  for (const s of snapshots) {
    if (s.priceMinor !== priceMinor) continue;
    if (latest === null || s.capturedAt.getTime() > latest.getTime()) {
      latest = s.capturedAt;
    }
  }
  return latest;
}

// --- Stale-sale guard thresholds (pure; see services/stale-guard.server.ts) ---

export interface StaleThresholds {
  warnDays: number;
  reviewDays: number;
  staleDays: number;
}

export const DEFAULT_STALE_THRESHOLDS: StaleThresholds = {
  warnDays: 60,
  reviewDays: 75,
  staleDays: 90,
};

export type StaleStatus = "fresh" | "warn" | "review" | "stale";

export function classifyStale(
  ageDays: number | null,
  compareAtMinor: number | null,
  thresholds: StaleThresholds = DEFAULT_STALE_THRESHOLDS,
): StaleStatus {
  if (compareAtMinor === null || ageDays === null) return "fresh";
  if (ageDays >= thresholds.staleDays) return "stale";
  if (ageDays >= thresholds.reviewDays) return "review";
  if (ageDays >= thresholds.warnDays) return "warn";
  return "fresh";
}

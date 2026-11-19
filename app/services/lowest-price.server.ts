// Lowest-price computation for EU Omnibus (Art 6a, Directive 2019/2161) and
// California B&P 17501 reference-price rules.
//
// Legal basis (verified against primary sources in research):
// - EU: a price-reduction announcement must show the prior price, defined as
//   the lowest price applied in a period not shorter than 30 days. Per-market
//   / per-currency histories.
// - Aldi (C-330/23): the "% off" figure must be computed from that same
//   30-day prior price.
// - CA B&P 17501: a "former price" must have been the prevailing market price
//   within the preceding 3 months (~90 days), UNLESS the date it prevailed is
//   clearly stated (date-disclosure exception).
// - FTC 16 CFR 233.1 states NO day count; the 90d figure comes from CA law.
//
// Server entry point: re-exports the client-safe math in app/lib/pricing.ts
// (routes import that path directly so the browser bundle never pulls a
// .server module).
export {
  CA_LOOKBACK_DAYS,
  EU_LOOKBACK_DAYS,
  MS_PER_DAY,
  caFormerPriceHeuristic,
  compareAtSince,
  discountFromPrior,
  euPriorPrice,
  euPriorPricePerMarket,
  lastObservedAt,
  lowestInWindow,
  parsePriceToMinor,
  type DiscountResult,
  type LowestPriceResult,
  type PricePoint,
} from "../lib/pricing";

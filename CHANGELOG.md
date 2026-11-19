# Changelog

## 0.1.0 — 2026-11-19

Initial PriceAnchor implementation (scaffolded from the dualunit skeleton,
stockguard submission patterns mirrored):

- Price history: append-only `price_snapshots` table (variant × market × currency).
- Webhooks: `products/create|update|delete` with payload price-diffing; GDPR
  handler purges history on shop/redact.
- Lowest-price compute: EU 30d prior per market, Aldi-rule % off, CA 90d heuristic.
- App-owned per-market metafields (`$app:priceanchor`, PUBLIC_READ storefront).
- Theme app extension: `lowest-price` block + dependency-free `priceanchor.js`.
- Stale-sale guard: 60/75/90-day compare-at tiers + GraphQL auto-clear.
- CSV/PDF evidence export (`/api/export`, Standard+), zero new dependencies.
- Billing repointed to tracked products: Free 25 / Standard $3.99 (250) /
  Unlimited $5.99.
- Admin: dashboard, products/history page, guard settings.
- Pi.dev-themed marketing/support site under `packages/site` (vendored engine demo).
- 84 vitest cases; `npm run validate` green.

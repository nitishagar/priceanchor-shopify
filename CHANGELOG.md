# Changelog

## 0.2.0 — 2026-11-19

Gap closure over the scaffold (US mode, scheduling, tier enforcement):

- US storefront mode: `former_price_<market>` metafields (90-day lowest +
  last-offered date) and "Previously $X — last offered Mon YYYY" framing
  for US shoppers; EU 30-day line unchanged.
- Localized EU phrasing in 8 languages (EN/DE/FR/ES/IT/NL/PL/SV) via theme
  locale keys passed to the engine as data attributes.
- Stale-sale auto-clear is now wired: webhook/snapshot captures clear
  stale-tier anchors when the shop enables it (Unlimited plan enforced
  in the service and the settings action).
- Tier map: Standard = CSV export + stale flagging; Unlimited adds PDF
  export + auto-clear. `/api/export` gates PDF to Unlimited.
- Daily snapshot backup: `POST /api/snapshot` (Bearer CRON_SECRET)
  re-captures every shop's catalog via offline sessions, scheduled
  14:00 UTC by `.github/workflows/snapshot.yml`.
- Site demo gains a US/EU market switch; engine behavior + locale suites
  added (26 node:test cases, smoke green).
- 109 vitest cases; `npm run validate` green; no schema drift.
- Pin `sst` to 4.5.9 (matches stockguard; newer SST needs node ≥ 22).

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

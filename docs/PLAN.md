# PriceAnchor — Build Plan (executed Nov 2026)

## 1. What PriceAnchor is

Omnibus lowest-price tracker for Shopify storefronts. Every price change is
captured automatically and stored per variant and per market; the storefront
shows the statutory prior price next to every reduction:

- **EU visitors** see the lowest price of the last 30 days (Art 6a, Directive
  2019/2161), tracked separately per market/currency — a German price drop
  never sets the French reference price.
- **% off** is computed from that 30-day prior price (Aldi C-330/23), never
  from the live compare-at price — the single most common Omnibus violation.
- **CA B&P 17501**: 90-day merchant-history heuristic for "former price"
  checks, with the statute's date-disclosure exception kept as a separate
  merchant decision (the exception swallows the rule for disclosers).
- **FTC 16 CFR 233.1** states no day count; the 90d figure comes from CA law only.

Incumbents charge per market (Easy Omnibus $9.99/market capped at $49.95) or
per tier (Complimus free ≤100 products, Business $14.99–$99.99). PriceAnchor
undercuts at Free / $3.99 / $5.99 with per-product (not per-variant) limits.

## 2. Architecture (mirrors dualunit/stockguard submission setup)

- Embedded admin app: React Router v7 + Polaris web components + App Bridge.
- DB: Neon PostgreSQL + Drizzle. Tables: `session` (auth), `shops` (plan,
  settings, trackedCount), `price_snapshots` (append-only history: shop,
  product, variant, market, currency, price/compare-at minor units, source).
- Webhooks: `products/create|update|delete` with payload price-diffing
  (products/update fires on ANY edit), GDPR compliance handler, plus the
  `app/*` lifecycle set.
- Theme app extension `priceanchor`: block `lowest-price.liquid` +
  dependency-free `assets/priceanchor.js` reading app-owned
  `priceanchor` metafields (`lowest_price_<market>`), plain metafieldsSet
  like DualUnit (no `access` input, no definitions).
- Stale-sale guard: 60/75/90-day compare-at age tiers (configurable per shop),
  auto-clear via Admin GraphQL `productVariantUpdate`.
- Export: `GET /api/export?format=csv|pdf` — hand-rolled CSV + minimal PDF,
  zero new dependencies. Standard/Unlimited only.
- Billing: Shopify Managed Pricing, synced from `currentAppInstallation` on
  auth and via `app_subscriptions/update`. Plans: free (25 products) /
  standard $3.99 (250 + export + guard) / unlimited $5.99.
- Deploy: SST v4 → AWS Lambda + CloudFront. CI: typecheck + lint + test +
  build, schema-drift gate, migration idempotency gate.
- Marketing/support site: `packages/site`, pi.dev website tokens vendored
  verbatim, with a live demo driving the shipped `priceanchor.js`.

## 3. Open items

- [x] O1: No repo — scaffolded from the dualunit skeleton, stockguard patterns mirrored.
- [x] O2: Price-history store, webhook diffing, lowest-price compute, metafields,
      theme block, stale guard, CSV/PDF export, repointed billing — implemented + tested.
- [x] O3: pi.dev-themed site with vendored-engine demo + token parity tests.
- [ ] O4: `DATABASE_URL`, `SHOPIFY_API_KEY/SECRET`, `SHOPIFY_APP_URL` secrets;
      Partner-dashboard app + Managed Pricing plans; submit for review —
      see `docs/SUBMISSION.md`.
- [x] O5: Daily snapshot backup job — `POST /api/snapshot` (Bearer
      CRON_SECRET) re-captures every shop's catalog via offline sessions,
      scheduled 14:00 UTC by `.github/workflows/snapshot.yml`.
- [ ] O6: 60/75/90d stale thresholds are product requirements without a cited
      statutory source — source before publishing compliance claims.
- [ ] O7: 10-install gate verdict (free-app-plan installs count) rests on
      converging evidence, not one explicit Shopify sentence — keep the 12–15
      buffer and optionally confirm via Partner support.

## 4. Verification

- `npm run validate` (typecheck + lint + test + build), Postgres migration gates in CI.
- `packages/site`: `npm test` (node:test copy/token/parity) + `scripts/smoke-site.sh`.
- Lowest-price windows, Aldi %, webhook diffing, stale tiers, CSV/PDF bytes,
  and plan gating each have vitest cases.

## 5. Submission path

`docs/SUBMISSION.md` is the launch checklist: Partner app, listing copy,
privacy/support URLs served from this repo's site, billing, review notes.
The human submits in the Partner Dashboard under their own login.

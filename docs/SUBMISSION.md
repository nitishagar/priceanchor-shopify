# PriceAnchor — App Store Submission Checklist

Mirrors the DualUnit/StockGuard submission setup file-for-file. Check off in order.
The human submits in the Partner Dashboard under their own Shopify login —
there is no auto-submit script, by design.

## 1. URLs & email

- [x] App origin is `https://priceanchor.applair.in` (Cloudflare Worker +
      custom domain); privacy + support are served by the app itself
      (`/privacy`, `/support`) and mirrored in `packages/site/`.
- [x] Support contact `support@applair.in`; privacy contact
      `privacy@applair.in`; issues at
      `github.com/nitishagar/priceanchor-shopify/issues`.
- [x] `shopify.app.toml` (`application_url` + `redirect_urls`) carries the
      origin; the Partner Dashboard URLs match it field-for-field.

## 2. Partner Dashboard app

- [x] Create app (App Store distribution), copy `client_id` into `shopify.app.toml`.
- [x] Distribution confirmed Public (Nov 22, 2026; passkey handoff).
- [x] App URL + redirect URLs → app URL (+ `/api/auth`).
- [x] Scopes: `read_products, write_products`.
- [x] Webhooks: `app/uninstalled`, `app/scopes_update`, `app_subscriptions/update`,
      `products/create`, `products/update`, `products/delete`, plus compliance
      topics → `/webhooks` (products/update verified live: edit → snapshot).
- [x] Managed Pricing plans: `standard` $3.99/mo + `unlimited` $5.99/mo
      (7-day trials, free for dev stores; handles must match
      `app/services/billing/plan-mapping.ts`). Annual variants deferred:
      invoice display names cap at 18 chars and `Unlimited (annual)` is 19
      (same as DualUnit).

## 3. Secrets & deploy

- [x] GitHub Secrets (exactly 4): `DATABASE_URL` (Neon `priceanchor`
      project, pooled URI), `CLOUDFLARE_API_TOKEN`, `APP_URL`
      (`https://priceanchor.nitishagar.workers.dev` — the snapshot caller
      uses workers.dev because the zone bot-challenges Actions IPs on the
      custom domain; all merchant-facing URLs stay on applair.in),
      `CRON_SECRET`.
- [x] Worker secrets (exactly 4, same names where shared):
      `DATABASE_URL`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`,
      `CRON_SECRET`. GitHub `CRON_SECRET` and Worker `CRON_SECRET`
      MUST match (single generation, pasted twice) — the snapshot
      workflow Bearer vs the route compare.
- [x] `npm run build && npx wrangler deploy` → `priceanchor` Worker +
      `priceanchor.applair.in` custom domain serves the app.
- [x] Deploy config + theme extension: `shopify app deploy` (priceanchor-4 ★).
- [x] Install on a dev store; change a price; verify history + the storefront
      lowest-price line (seo-generator: "Lowest price in the last 30 days:
      ₹2,299.95 (−4.3%)", math hand-checked). No "Shopify" in URLs/emails;
      icon 1200x1200 uploaded (`docs/listing/icon-1200.png`).

## 4. Listing

- [x] Name: PriceAnchor. Category: Store design › Product display › Other.
- [x] Introduction (100 chars): see `docs/listing/LISTING.md` (submitted verbatim).
- [x] Details (500 chars) + 5 features: see `docs/listing/LISTING.md`.
- [x] Screenshots (1600×900, `docs/listing/`): dashboard, products/history,
      storefront lowest-price line (feature image), stale-guard settings.
      Real UI only; no app pricing in images; no stats/superlatives.
- [x] Demo screencast in English: `public/videos/priceanchor-onboarding.mp4`
      (1280×720, 2fps, 196s) served from the app URL.
- [x] Support: email `support@applair.in` + portal `/support` on the app URL.
- [x] Privacy URL: `/privacy` on the app URL.
- [x] Pricing display names + top features; discovery subtitle + search terms;
      Online Store requirement; review + submission emails; test instructions
      ("no account required" + numbered flow + demo storefront URL).

## 5. Review readiness

- [x] `npm run validate` green (18 files / 125 tests); CI gates green.
- [x] GDPR endpoints return 200/404 correctly (`gdpr-webhooks.test.ts`).
- [x] Automated checks: "Passed automated check for common errors" (Nov 22).
- [x] Capabilities: none apply; AI self-review marked done; no customer data.
- [x] Test instructions ("no account required" + numbered flow + demo
      storefront URL + store password) + screencast (install → price change
      → history → storefront line → settings).
- [ ] Gate strategy (Nov 10, 2026 limits): one new app in review at a time; each
      published app in the org needs 10+ installs from active stores on paid
      SHOPIFY plans (free-APP-plan installs count; dev + free-trial stores
      excluded; no published apps = exempt). Keep a 12–15 buffer; counts update
      daily. Fix resubmits promptly to avoid Paused cooldowns.
- [x] Org state Nov 22, 2026: DualUnit is Submitted (in review) → Partner
      Dashboard shows "Submission limited" for PriceAnchor. Everything above
      is prepared; click "Submit for review" once DualUnit's review resolves.

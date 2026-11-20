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

- [ ] Create app (App Store distribution), copy `client_id` into `shopify.app.toml`.
- [ ] App URL + redirect URLs → app URL (+ `/api/auth`).
- [ ] Scopes: `read_products, write_products`.
- [ ] Webhooks: `app/uninstalled`, `app/scopes_update`, `app_subscriptions/update`,
      `products/create`, `products/update`, `products/delete`, plus compliance
      topics → `/webhooks`.
- [ ] Managed Pricing plans: `Standard` $3.99, `Unlimited` $5.99 (+ annual variants
      `Standard (annual)`, `Unlimited (annual)` — names must match
      `app/services/billing/plan-mapping.ts`).

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
- [ ] Deploy config + theme extension: `shopify app deploy`.
- [ ] Install on a dev store; change a price; verify history + the storefront
      lowest-price line. No "Shopify" in URLs/emails; icon 1200x1200.

## 4. Listing

- [ ] Name: PriceAnchor. Category: Store design / Compliance.
- [ ] Tagline: “EU Omnibus lowest-price tracking from automatic price history.”
- [ ] Description: automatic per-market price history → statutory lowest price of
      the last 30 days next to every reduction, Aldi-rule % off, stale-sale guard,
      CSV/PDF evidence export, no customer data.
- [ ] Screenshots: admin dashboard, products/history page, storefront lowest-price
      line, stale-guard settings. Real UI only; no pricing in images; no stats,
      superlatives, or testimonials. Demo screencast in English.
- [ ] Support URL: `/support` on the app URL (+ support email).
- [ ] Privacy URL: `/privacy` on the app URL.
- [ ] Pricing: Free / $3.99 / $5.99 with 7-day trials. Test credentials for
      reviewers incl. a 2FA-exempt account; emergency dev contact on file.

## 5. Review readiness

- [ ] `npm run validate` green; CI gates (schema-drift, migration idempotency) green.
- [ ] GDPR endpoints return 200/404 correctly (`gdpr-webhooks.test.ts`).
- [ ] Test store login for reviewers + screencast of install → price change → history → storefront line.
- [ ] Gate strategy (Nov 10, 2026 limits): one new app in review at a time; each
      published app in the org needs 10+ installs from active stores on paid
      SHOPIFY plans (free-APP-plan installs count; dev + free-trial stores
      excluded; no published apps = exempt). Keep a 12–15 buffer; counts update
      daily. Fix resubmits promptly to avoid Paused cooldowns.

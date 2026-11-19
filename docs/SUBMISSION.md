# PriceAnchor — App Store Submission Checklist

Mirrors the DualUnit/StockGuard submission setup file-for-file. Check off in order.
The human submits in the Partner Dashboard under their own Shopify login —
there is no auto-submit script, by design.

## 1. URLs & email

- [ ] Decide the app domain (or use the SST CloudFront URL); privacy + support
      are served by the app itself (`/privacy`, `/support`) and mirrored in
      `packages/site/`.
- [ ] Support contact `support@priceanchor.example.com`; privacy contact
      `privacy@priceanchor.example.com` (replace example.com with the real domain).
- [ ] Backend App URL comes from the first `sst deploy` CloudFront URL — copy it into
      `shopify.app.toml` (`application_url` + `redirect_urls`) and the Partner Dashboard.

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

- [ ] GitHub secrets: `DATABASE_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
      `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `APP_URL`
      (same deployed base URL), `CRON_SECRET` (`openssl rand -hex 32`; must
      match the app's `CRON_SECRET` env for `POST /api/snapshot`).
- [ ] `npx sst deploy --stage production` → verify the URL serves the app.
- [ ] Deploy the theme extension: `shopify app deploy`.
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

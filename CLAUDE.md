## Code Quality

After every code change, you MUST:
1. Run `npm run validate` to verify typecheck + lint + test + build all pass.
2. IMPORTANT: You MUST resolve any issues before proceeding.
3. Never commit secrets, tokens, .env files, or .claude/ directories.
4. Never use Co-Authored-By in commits.

## Project Structure

- `app/` - React Router v7 app (routes, services, components)
- `app/db/schema.ts` - Drizzle ORM schema (sessions, shops, price_snapshots)
- `app/db.server.ts` - Neon PostgreSQL connection (HTTP driver, stateless)
- `app/shopify.server.ts` - Shopify app configuration + afterAuth hook (plan sync only)
- `app/lib/pricing.ts` - Client-safe pricing math (lowest-price windows, Aldi %, stale tiers)
- `app/services/` - Business logic services:
  - `price-history.server.ts` - Snapshot store + webhook payload price-diffing
  - `price-webhook.server.ts` - products/create|update|delete orchestration
  - `lowest-price.server.ts` - EU-30d / CA-90d compute (re-exports lib)
  - `metafields.server.ts` - Per-market lowest-price metafields (plain namespace)
  - `stale-guard.server.ts` - Compare-at age tiers + GraphQL auto-clear
  - `export.server.ts` - Dependency-free CSV + PDF writers
  - `graphql-types.server.ts` - Shared AdminGraphQLClient structural type
  - `plan-enforcer.server.ts` - Three-tier plan gating (tracked products)
  - `billing/` - Managed Pricing sync + plan mapping
  - `shop.server.ts` - Shop get-or-create
- `app/routes/` - React Router v7 routes (dashboard, products, settings, pricing, support, privacy, api/export, webhooks)
- `extensions/priceanchor/` - Theme app extension (lowest-price block + locales + dependency-free `priceanchor.js`)
- `packages/site/` - Pi.dev-themed marketing/support site (static, ships privacy + support URLs)
- `drizzle/` - Versioned migrations (drizzle-kit generate + migrate; run via `npm run db:migrate`)
- `docs/` - PLAN.md (build plan + open items), SUBMISSION.md (launch checklist)

## Tech Stack

- SST v4 + AWS Lambda (arm64, 256MB) + CloudFront
- Neon PostgreSQL + Drizzle ORM (HTTP driver)
- React Router v7 + Polaris Web Components + App Bridge
- Vitest for testing (services, routes, export writers, webhook diffing)
- Backend URL: SST CloudFront URL (set after first deploy; see docs/SUBMISSION.md)
- Public site: packages/site (privacy + support URLs served by the app)
- Emails: support@priceanchor.example.com (support), privacy@priceanchor.example.com (privacy)

## Commands

- `npm run dev` - Start dev server (via Shopify CLI)
- `npm run validate` - Full validation (typecheck + lint + test + build)
- `npm run test` - Run tests
- `npm run db:push` - Push schema to database
- `npm run db:generate` - Generate migrations

## Architecture Notes

- Price history is append-only; products/update diffing ignores non-price edits.
- Lowest-price math lives in `app/lib/pricing.ts` (client-safe); `.server.ts`
  modules must never be imported by route components (build breaks).
- Each market keeps its own history; the % off comes from the 30-day prior
  price (Aldi rule), never from compare-at.
- Limits count tracked PRODUCTS, not variants.

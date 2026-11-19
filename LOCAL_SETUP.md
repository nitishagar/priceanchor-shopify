# Local Setup Guide

## Prerequisites

- Node.js >= 20.19 (recommended: use nvm)
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli): `npm install -g @shopify/cli`
- A [Shopify Partner account](https://partners.shopify.com/) with a development store
- A [Neon PostgreSQL](https://neon.tech/) project (free tier)

## 1. Clone and Install

```bash
git clone git@github.com:nitishagar/priceanchor-shopify.git
cd priceanchor-shopify
npm install
```

## 2. Environment Variables

Copy the example and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
SHOPIFY_API_KEY=<from shopify.app.toml client_id>
SHOPIFY_API_SECRET=<from Shopify Partner Dashboard → App → API credentials>
SCOPES=read_products,write_products
```

## 3. Push Database Schema

```bash
npm run db:push
```

This creates all tables (session, shops) in your Neon database.

## 4. Run Locally (Shopify Dev)

```bash
shopify app dev
```

This will:
- Start the Vite dev server
- Create a tunnel to your local machine
- Open the app in your Shopify dev store admin

On first run, you'll be prompted to:
1. Log in to your Shopify Partner account
2. Select or create a dev store
3. Install the app on the dev store

## 5. Verify It Works

- The app should load in your Shopify admin at `Apps > PriceAnchor`
- Dashboard page shows the setup checklist (no history yet)
- Products page lists tracked products once the first snapshots land
- Settings page shows display mode and plan info
- Check Neon dashboard to confirm session was stored

## Running Tests

```bash
npm run test          # Run tests once
npm run test:watch    # Watch mode
npm run validate      # Full pipeline: typecheck + lint + test + build
```

## Database Management

```bash
npm run db:push       # Push schema changes to Neon
npm run db:generate   # Generate migration files
npm run db:studio     # Open Drizzle Studio (visual DB browser)
```

## AWS Deployment (SST)

For deploying to AWS Lambda + CloudFront:

### First-time setup

Add AWS credentials to `.env`:

```
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
AWS_REGION=us-east-1
```

### Deploy

```bash
# Dev stage
npx sst deploy --stage dev

# Production
npx sst deploy --stage production
```

### Verify deployment

After `sst deploy`, the CLI outputs the CloudFront URL. Visit it to verify:
- App loads via CloudFront URL
- OAuth flow works (install on dev store using CloudFront URL)
- Webhooks process correctly

### Remove deployment

```bash
npx sst remove --stage dev
```

## Project Structure

```
priceanchor-shopify/
├── app/
│   ├── db.server.ts              # Neon DB connection
│   ├── db/schema.ts              # Drizzle schema (session, shops, price_snapshots)
│   ├── shopify.server.ts         # Shopify app config + session storage
│   ├── lib/pricing.ts            # Client-safe pricing math
│   ├── services/                 # Business logic
│   │   ├── price-history.server.ts   # Snapshot store + webhook diffing
│   │   ├── lowest-price.server.ts    # EU-30d / CA-90d compute
│   │   ├── metafields.server.ts      # Per-market lowest-price metafields
│   │   ├── stale-guard.server.ts     # Compare-at age tiers + auto-clear
│   │   ├── export.server.ts          # CSV + PDF writers
│   │   ├── plan-enforcer.server.ts
│   │   └── billing/              # Managed Pricing sync + mapping
│   ├── routes/                   # React Router v7 routes
│   │   ├── app._index.tsx        # Dashboard
│   │   ├── app.products.tsx      # Tracked products + history
│   │   ├── app.settings.tsx      # Guard settings
│   │   ├── api.export.ts         # CSV/PDF export
│   │   └── webhooks.*.ts         # Webhook handlers
│   └── __tests__/                # Vitest tests
├── extensions/
│   └── priceanchor/              # Theme app extension
│       ├── blocks/lowest-price.liquid
│       ├── assets/priceanchor.js # Storefront renderer (vendored by site)
│       └── locales/
├── packages/site/                # Pi.dev-themed marketing/support site
├── sst.config.ts                 # SST deployment config
├── drizzle.config.ts             # Drizzle Kit config
├── shopify.app.toml              # Shopify app manifest
└── shopify.web.toml              # Shopify web config
```

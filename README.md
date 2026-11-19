# PriceAnchor — Omnibus Lowest-Price Tracking for Shopify

Automatic per-market price history. Shoppers see the statutory lowest price of
the last 30 days (EU Omnibus Art 6a) next to every reduction, with the “% off”
computed from that prior price (Aldi rule) — never from a stale compare-at
anchor. Real-time capture from product webhooks plus a daily snapshot backup.

## Features

- **Automatic price history**: append-only per-variant, per-market snapshots from
  `products/create|update|delete` webhooks (price-diffed; non-price edits ignored).
- **EU Omnibus prior price**: 30-day minimum per market/currency; Aldi-rule % off.
- **CA/FTC awareness**: 90-day merchant-history heuristic for CA B&P 17501 former
  prices (with the date-disclosure exception kept separate); FTC bona-fide rule noted.
- **Lowest-price theme block**: storefront line reading app-owned metafields
  (`$app:priceanchor`, `PUBLIC_READ`), hiding itself when no reduction applies.
- **Stale-sale guard**: flags compare-at anchors older than 60/75/90 days
  (configurable), with optional auto-clear via the Admin API.
- **CSV/PDF evidence export**: dependency-free RFC 4180 CSV + minimal PDF writer.
- **Tiered plans**: Free (25 products) / Standard $3.99 (250 + export + guard) /
  Unlimited $5.99. Limits count tracked products, not variants.
- **GDPR compliant**: full compliance webhook handlers incl. history purge.

## Tech Stack

- **Framework**: React Router v7 + Shopify App Bridge
- **UI**: Polaris web components
- **Database**: Neon PostgreSQL + Drizzle ORM
- **Session Storage**: `@shopify/shopify-app-session-storage-drizzle`
- **Deployment**: SST v4 → AWS Lambda (arm64) + CloudFront
- **Testing**: Vitest (services, routes, export writers)
- **Marketing site**: `packages/site` (pi.dev-themed static site, vendored engine demo)

## Getting Started

See [LOCAL_SETUP.md](LOCAL_SETUP.md) for full setup instructions.

### Quick Start

```bash
npm install
cp .env.example .env   # fill in your values
npm run db:push         # push schema to Neon
shopify app dev         # start local dev server
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (via Shopify CLI) |
| `npm run validate` | Typecheck + lint + test + build |
| `npm run test` | Run tests |
| `npm run db:push` | Push schema to database |
| `npm run db:generate` | Generate migrations from schema |
| `npx sst deploy --stage dev` | Deploy to AWS |

## Architecture

```
products/create|update webhook → price-diff vs latest snapshot
  → changed? record snapshot → recompute 30d prior → write $app metafield
Storefront: theme block reads metafield + live price
  → priceanchor.js renders lowest-price line (no network, no FX)
Admin: dashboard + products/history + guard settings (Polaris)
DB: sessions + shops (plan, settings, trackedCount) + price_snapshots
```

## Docs

- [docs/PLAN.md](docs/PLAN.md) — build plan, research summary, open items
- [docs/SUBMISSION.md](docs/SUBMISSION.md) — App Store launch checklist
- [LOCAL_SETUP.md](LOCAL_SETUP.md) — local development setup

## License

MIT

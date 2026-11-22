# PriceAnchor — App Store Listing Draft

Source of truth for the Partner Dashboard listing. Assets in this folder.

## Identity

- **Name:** PriceAnchor
- **Tagline:** EU Omnibus lowest-price tracking from automatic price history.
- **Category:** Store design
- **Icon:** `icon-1200.png` (1200×1200)

## Introduction (submitted verbatim, 91/100)

Automatic price history for EU Omnibus compliance. Every reduction shows its 30-day lowest.

## Details (submitted verbatim, 498/500)

PriceAnchor records every price change automatically, per variant and per
market, via webhooks plus a daily snapshot. When you lower a price,
shoppers see the lowest price of the last 30 days next to the reduction,
as the EU Omnibus directive requires. The percent-off figure is computed
from that prior price, never from the live compare-at price. A
stale-sale guard flags compare-at anchors older than your thresholds for
review or auto-clear, and the full history exports as CSV or PDF evidence.

## Description (longer draft, not submitted)

Every price change in your store is captured automatically — per variant
and per market — so every reduction shows its statutory prior price:

- **EU shoppers** see the lowest price of the last 30 days (Omnibus
  Art 6a, Directive 2019/2161), tracked separately per market and
  currency.
- **% off** is computed from that 30-day prior price (Aldi C-330/23),
  never from the live compare-at price.
- **Stale-sale guard** flags compare-at anchors older than your
  thresholds (60/75/90 days) for review or auto-clear.
- **Evidence export** downloads the full price history as CSV or PDF
  for audits and disputes.

No customer data is collected, ever.

## Features (bullets)

- Automatic per-variant, per-market price history (webhooks + daily snapshot)
- Statutory 30-day lowest price next to every reduction (OS 2.0 theme block)
- Aldi-rule % off from the prior price, never from compare-at
- Stale compare-at guard with configurable age tiers + auto-clear
- CSV/PDF evidence export on paid plans
- GDPR compliant; zero customer data collected

## Pricing (Managed Pricing — names must match exactly)

- Free: 25 tracked products
- `Standard` $3.99/mo: 250 products + export + stale-sale guard
- `Unlimited` $5.99/mo: unlimited products + auto-clear + priority support
- 7-day free trials on paid plans; free on dev stores
- Annual variants deferred (invoice display names cap at 18 chars, so
  `Unlimited (annual)` at 19 chars cannot be created)

## URLs

- App URL: `https://priceanchor.applair.in`
- Privacy: `https://priceanchor.applair.in/privacy`
- Support: `https://priceanchor.applair.in/support` + `support@applair.in`
- Pricing info: `https://priceanchor.applair.in/pricing`

## Screenshots (all 1600×900)

- Shot 1: `1-dashboard.png` — admin dashboard
- Shot 2: `2-products.png` — price history table
- Shot 3: `3-storefront-line.png` — storefront lowest-price line on a live PDP
- Shot 4: `4-settings.png` — stale-sale guard settings

## Review notes (for the reviewer)

- Install on the provided dev store, open the app, change a product
  price or compare-at price, add the "Lowest price" block in the theme
  editor.
- Test card not needed: install flow + Free plan cover all review paths
  except CSV/PDF export and auto-clear (paid plans; free for dev stores).
- Storefront line appears only when the current price is below the
  30-day prior price (nothing to disclose otherwise).
- Test store: seo-generator (password `owstem`).
- Contact: `support@applair.in`, typically within 24h on business days.

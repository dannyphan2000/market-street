# Approaching Discounts Extension

This extension renders a progress banner that shows shoppers how close their basket is
to unlocking order and shipping promotions, using the Shopper Baskets SCAPI
`expand=approaching_discounts` data.

## Features

- **Presentational banner**: derives approaching/achieved state from the basket and
  renders up to `maxDiscounts` banners (defaults to `1`)
- **Plug-and-play integration**: registers via `target-config.json` only — no edits to
  core cart/checkout files required
- **Bundled on four surfaces**: all four slots are registered with `enabled: true` (bundled
  and available); the per-surface render default is controlled by each Component Visibility
  toggle in Business Manager

## Architecture

### How it plugs in

The extension wires into the cart and checkout surfaces via the UI-target system. Core
files are not modified. The same surface component is registered against all four slots.

| Surface | Slot | Purpose |
| --- | --- | --- |
| Checkout order summary | `sfcc.checkout.orderSummary.body.before` | Reads the basket, derives approaching/achieved discounts, and renders the banner(s). |
| Cart order summary | `sfcc.cart.orderSummary.body.before` | Same surface component, rendered above the cart order summary. |
| Cart promotions region | `sfcc.cart.promotions.approachingDiscounts` | Same surface component, rendered in the cart promotions region. |
| Mini-cart promotions region | `sfcc.miniCart.promotions.approachingDiscounts` | Same surface component, rendered in the mini-cart promotions region. |

> **Bundling vs. visibility:** `enabled: true` in `target-config.json` means the component
> is bundled and available on that slot — it is not the render decision. Whether the banner
> actually renders is governed by the slot's `storefrontComponentVisibility` toggle, whose
> per-surface defaults are set in `app-configuration/adminComponents.json`.

### Files

```
src/extensions/approaching-discounts/
├── README.md                                         ← you are here
├── target-config.json                                ← UITarget registration (four slots, all bundled)
├── components/
│   ├── approaching-discounts-banner/index.tsx        # Presentational banner
│   └── target/approaching-discounts-surface.tsx      # Slot-registered surface
├── hooks/
│   └── use-approaching-discounts-state.ts            # Derives approaching/achieved state from the basket
├── types/
│   └── approaching-discounts.ts                      # View-model + SCAPI normalization helpers
└── locales/
    └── <locale>/translations.json                    # Banner copy per locale
```

## Setup

The extension is bundled on four surfaces, each with its own visibility default. To adjust:

1. Confirm the instance exposes the Shopper Baskets SCAPI `expand=approaching_discounts` data.
2. In Business Manager, adjust each surface's toggle under the app's Component Visibility
   (cart order summary and mini-cart ship visible; checkout and the cart promotions region
   ship hidden).

## Local development

Extensions are not built on their own — the template's Vite build discovers and compiles
them. To preview locally, copy this extension into your storefront-next project and run
the dev server from the project root:

```bash
# From your storefront-next project root
pnpm dev
```

## Usage

Once visible, the banner appears on its enabled surfaces (cart order summary and mini-cart
by default). It shows:

- **Approaching** — "You're {{amount}} away from {{discount}}" with a progress bar, when
  the basket is below a promotion threshold.
- **Achieved** — "Score! Your order qualifies for {{discount}}" when the basket already
  qualifies for a promotion.

## Resources

- [Shopper Baskets SCAPI](https://developer.salesforce.com/docs/commerce/commerce-api/references/shopper-baskets)

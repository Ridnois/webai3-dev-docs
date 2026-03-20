---
title: "Fix Plan: Hardcoded Prices in Landing App"
description: Audit and correction plan for price strings that are hardcoded instead of driven by presale-config.ts. Implemented in commit 1bf3574.
section: Devlog
order: 2
---

> **Status: Implemented** — All items below were addressed in commit `1bf3574`. See [Landing: Prices Fix & Live On-Chain Phase](/docs/devlog/landing-live-phase-mar-2026) for the implementation notes.

## Problem

`presale-config.ts` correctly centralises all presale pricing behind env vars and defaults. However, multiple components have copy and button labels with prices embedded as string literals (`"$0.01"`, `"$0.12"`, `"12x"`). When the active phase changes — or the listing target is adjusted — these strings will silently stay stale while the rest of the UI updates correctly.

**The config already has the right data:**

```ts
// src/lib/presale-config.ts
config.phases[currentIndex].priceUsd   // current phase price
config.listingPriceUsd                 // listing target (default 0.12)
```

Everything should be derived from these values.

---

## Affected Files

### High Priority — Always visible to users

| File | Line(s) | Hardcoded value | Fix |
|---|---|---|---|
| `src/components/header.tsx` | ~94 | `listing target $0.12` | Use `formatCurrency(config.listingPriceUsd)` |
| `src/components/header.tsx` | ~171 | `Buy AIC at $0.01` | Use `Buy AIC at ${formatCurrency(current.priceUsd)}` |
| `src/components/mobile-nav.tsx` | ~155 | `Buy AIC at $0.01` | Same as header — pass `current.priceUsd` from config |
| `src/components/sections/hero.tsx` | ~85 | badge: `at $0.01` | `at ${formatCurrency(current.priceUsd)}` |
| `src/components/sections/hero.tsx` | ~99 | `lock in at $0.01` | Use `formatCurrency(current.priceUsd)` |
| `src/components/sections/hero.tsx` | ~110 | `Buy AIC at $0.01` | Use `formatCurrency(current.priceUsd)` |
| `src/components/presale/presale-hero-card.tsx` | ~99 | `$0.12 (12x from Phase 1)` | Compute from config (see below) |
| `src/components/presale/presale-hero-card.tsx` | ~114 | `Buy AIC at $0.01` | Use `formatCurrency(current.priceUsd)` |

### Medium Priority — Visible but below the fold

| File | Line(s) | Hardcoded value | Fix |
|---|---|---|---|
| `src/components/presale/presale-cta-strip.tsx` | ~56 | `$0.12 (12x from Phase 1 entry)` | Compute from config (see below) |
| `src/components/sections/tokenomics.tsx` | ~74 | `{ label: "Listing Target", value: "$0.12" }` | Read `config.listingPriceUsd` |

### Low Priority — Meta / SEO (not visible in UI)

| File | Line(s) | Hardcoded value | Fix |
|---|---|---|---|
| `src/app/layout.tsx` | 50, 52, 54, 56 | `$0.01`, `12x listing target`, `$0.12` | Call `getPresaleConfig()` at build time and interpolate |

---

## How to Compute the Listing Multiple

The "12x" figure is derived from `listingPriceUsd / phase[0].priceUsd`. It should be computed, not hardcoded:

```ts
const config = getPresaleConfig();
const phase1Price = config.phases[0]?.priceUsd ?? config.phases[currentIndex].priceUsd;
const listingMultiple = Math.round(config.listingPriceUsd / phase1Price);
// "12x from Phase 1" → `${listingMultiple}x from ${config.phases[0].name}`
```

Use this pattern wherever the multiple is currently written as `12x`.

---

## How to Fix `layout.tsx`

`layout.tsx` runs server-side / at build time, so it can call `getPresaleConfig()` directly:

```ts
import { getPresaleConfig } from "@/lib/presale-config";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    maximumFractionDigits: value < 0.01 ? 4 : 2,
  }).format(value);
}

// Inside the metadata export:
const config = getPresaleConfig();
const currentIndex = config.phases.findIndex(p => p.id === config.currentPhaseId);
const current = config.phases[currentIndex] ?? config.phases[0];
const phase1 = config.phases[0];
const multiple = Math.round(config.listingPriceUsd / phase1.priceUsd);

export const metadata: Metadata = {
  title: `AIC Token Presale — ${current.name} at ${formatCurrency(current.priceUsd)} | webai3.protocol`,
  description: `Secure your AIC allocation at ${current.name} pricing (${formatCurrency(current.priceUsd)} per token). ${multiple}x listing target. Phase-based pricing increases automatically.`,
  // ...
};
```

---

## How to Fix Components

Most affected components already call `getPresaleConfig()` or receive `config` as a prop — the fix is replacing the literal string with the computed value:

```tsx
// Before
<span>Buy AIC at $0.01</span>

// After
<span>Buy AIC at {formatCurrency(current.priceUsd)}</span>
```

For `mobile-nav.tsx` and `header.tsx`, check if `getPresaleConfig()` is already called. If not, add the call and destructure `current` the same way the hero and presale-panel do.

---

## What Is Correctly Config-Driven (do not change)

The following already read from config and are correct:

- All `priceUsd` calculations and display in `presale-hero-card.tsx`, `presale-panel.tsx`, `presale-cta-strip.tsx`, `hero.tsx`
- Phase progression and next-phase preview in all components
- Token allocation math (`intentSampleUsd / current.priceUsd`)
- `presale-config.ts` defaults themselves

---

## Priority Order

1. `header.tsx` and `mobile-nav.tsx` — shown on every page, immediately stale when phase 1 sells out
2. `hero.tsx` — above the fold, first thing users read
3. `presale-hero-card.tsx` — primary conversion component
4. `presale-cta-strip.tsx` and `tokenomics.tsx` — visible but below fold
5. `layout.tsx` — SEO only, lower urgency but correct for search indexing

---
title: "Landing: Internationalization Plan"
description: Plan to add multi-language support to webai3-landing using next-intl — locale routing, translation files, and component migration strategy.
section: Devlog
order: 5
status: pending
---

## Problem

Every string in `webai3-landing` is hardcoded in English inside JSX. The crypto audience is global — Spanish, Chinese, Portuguese, and Turkish speakers make up a large share of DeFi participants, and none of them get a localized experience.

There is no i18n infrastructure at all: no routing, no translation files, no locale detection, no `lang` attribute beyond the hardcoded `lang="en"` in `layout.tsx`.

---

## Proposed Stack

**[next-intl](https://next-intl.dev)** — the standard i18n library for the Next.js App Router. It integrates with React Server Components and static generation, which matches the landing site's architecture (no backend, no database).

```bash
pnpm add next-intl
```

No other library needed.

---

## Target Locales (Initial Launch)

| Locale | Language | Rationale |
|---|---|---|
| `en` | English | Default |
| `es` | Spanish | Largest non-English crypto community in LatAm/Spain |
| `zh` | Chinese (Simplified) | Largest DeFi retail market |
| `pt` | Portuguese | Brazil is top-5 crypto adoption globally |
| `tr` | Turkish | High crypto retail penetration |

All locales ship at launch. English is the fallback for any missing translation key.

---

## Routing Strategy

next-intl uses path-prefix routing by default:

```
/          → redirects to /en (or detected browser locale)
/en        → English landing
/es        → Spanish landing
/zh        → Chinese landing
/pt        → Portuguese landing
/tr        → Turkish landing
```

The `next.config.ts` gets a `createNextIntlPlugin()` wrapper. A `src/i18n/routing.ts` file defines the supported locales and default.

---

## File Structure

```
src/
├── i18n/
│   ├── routing.ts          # locales array, defaultLocale
│   └── request.ts          # getRequestConfig — loads messages per locale
├── messages/
│   ├── en.json
│   ├── es.json
│   ├── zh.json
│   ├── pt.json
│   └── tr.json
└── app/
    └── [locale]/           # new dynamic segment wraps all routes
        ├── layout.tsx       # sets <html lang={locale}>
        ├── page.tsx
        └── presale/
            └── page.tsx
```

---

## Translation File Shape

Each `messages/{locale}.json` mirrors the component tree:

```json
{
  "hero": {
    "badge": "Pay-per-request AI inference · AIC presale live",
    "headline": "Run any AI model.\nPay only for what you use.",
    "subheadline": "Connect your wallet. Sign a USDC payment. Get results.",
    "ctaPrimary": "Buy AIC",
    "ctaSecondary": "See how it works",
    "proofPoints": {
      "models": {
        "label": "Run any model, pay per request",
        "desc": "Access top AI models through a single API. Pay exactly what you use in USDC — no subscriptions, no minimums."
      },
      "utility": {
        "label": "Real token utility",
        "desc": "AIC holders get staking discounts on inference costs, governance rights, and a share of platform revenue."
      },
      "onchain": {
        "label": "Transparent & onchain",
        "desc": "Every payment settles onchain. Public vesting schedule, automatic phase pricing, and verified contracts."
      }
    }
  },
  "nav": {
    "howItWorks": "How it works",
    "tokenomics": "Tokenomics",
    "roadmap": "Roadmap",
    "launchApp": "Launch App",
    "buyAic": "Buy AIC"
  },
  "presale": {
    "phase": "Phase {n}",
    "pricePerToken": "{price} per token",
    "nextPhaseIn": "Next phase in {pct}%",
    "saveVsNext": "Save {pct}% vs next phase",
    "buyButton": "Buy {symbol}",
    "minAmount": "Min {amount}",
    "maxAmount": "Max {amount}"
  }
}
```

Dynamic values (prices, percentages, token symbol) remain as interpolation params — they come from `presale-config.ts` at runtime, not from the translation files.

---

## Component Migration

All sections need to replace inline strings with `useTranslations()` (client) or `getTranslations()` (server):

### Server Component example

```tsx
// Before
export async function HeroSection() {
  return <h1>Run any AI model. Pay only for what you use.</h1>
}

// After
import { getTranslations } from "next-intl/server";

export async function HeroSection() {
  const t = await getTranslations("hero");
  return <h1>{t("headline")}</h1>
}
```

### Client Component example

```tsx
// Before
export function Header() {
  return <nav><a href="#how-it-works">How it works</a></nav>
}

// After
"use client";
import { useTranslations } from "next-intl";

export function Header() {
  const t = useTranslations("nav");
  return <nav><a href="#how-it-works">{t("howItWorks")}</a></nav>
}
```

---

## Metadata Per Locale

The `layout.tsx` metadata (title, description, OG) should also vary by locale. next-intl provides `getTranslations()` in server components, so the `generateMetadata` function can pull from translation files:

```tsx
export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: "metadata" });
  return {
    title: { default: t("title"), template: `%s | WebAI3` },
    description: t("description"),
    openGraph: { title: t("title"), description: t("description") },
  };
}
```

This also means OG tags are translated — important for social shares in non-English markets.

---

## Sections to Translate

All 13 section components in `src/components/sections/` plus the header, footer, and presale panel:

| File | Namespace |
|---|---|
| `hero.tsx` | `hero` |
| `problem-solution.tsx` | `problem` |
| `how-it-works.tsx` | `howItWorks` |
| `advantages.tsx` | `advantages` |
| `tokenomics.tsx` | `tokenomics` |
| `roadmap.tsx` | `roadmap` |
| `presale-buy.tsx` | `presaleBuy` |
| `why-buy.tsx` | `whyBuy` |
| `vision.tsx` | `vision` |
| `cta.tsx` | `cta` |
| `conclusion.tsx` | `conclusion` |
| `team.tsx` | `team` |
| `powered-by.tsx` | `poweredBy` |
| `header.tsx` | `nav` |
| `footer.tsx` | `footer` |
| `presale-panel.tsx` | `presale` |
| `layout.tsx` metadata | `metadata` |

---

## What Does Not Need Translation

- Prices, percentages, phase names — these come from `presale-config.ts` as numbers and are formatted by `Intl.NumberFormat` which already handles locale-specific number formatting
- Contract addresses, wallet addresses — not user-facing strings
- Error messages from on-chain interactions — handled by wagmi/viem
- Legal pages (`/terms`, `/risk`) — can remain English-only initially

---

## Implementation Order

```
1. pnpm add next-intl
2. Create src/i18n/routing.ts and src/i18n/request.ts
3. Wrap next.config.ts with createNextIntlPlugin()
4. Move app/ → app/[locale]/, update layout to set lang={locale}
5. Create messages/en.json with all English strings
6. Migrate all 16 components to useTranslations / getTranslations
7. Add locale switcher to header
8. Translate messages/es.json (Spanish)
9. Translate zh.json, pt.json, tr.json
10. Update generateMetadata in layout.tsx to use translations
11. Add hreflang link tags for SEO
```

---
title: "Landing: Product-First Metadata"
description: Rewriting the landing app's title, description, and OG tags to lead with the product (pay-per-use AI inference) instead of the presale.
section: Devlog
order: 4
status: pending
---

## Problem

The landing app's `<title>` and `<meta description>` were framed entirely around the presale:

```
Title:       AIC Token Presale — Phase 1 at $0.01 | webai3.protocol
Description: Secure your AIC allocation at Phase 1 pricing ($0.01 per token).
             12x listing target. Phase-based pricing increases automatically.
             Join the presale now.
```

This makes the page look like a token sale with no product behind it. Anyone clicking through from search or social who isn't already looking for a presale gets no signal that there's a real product.

The OG description was identical to the meta description — no differentiation between in-page display and social share cards.

---

## Changes

**`webai3-landing/src/app/layout.tsx`**

### Title

Before:
```
AIC Token Presale — Phase 1 at $0.01 | webai3.protocol
```

After (using Next.js `title.template`):
```
WebAI3 — Pay-per-use AI inference on Ethereum
```

The presale phase and price now appear in the description, not the title. The title communicates what the product does.

### Description

Before: presale pitch with price and listing multiple.

After:
```
Run any AI model and pay exactly for what you use — no subscription,
no credits. Connect your wallet, sign a USDC payment, get results.
AIC token presale live at $0.01 · 12x listing target.
```

Product value proposition first. Presale as a secondary fact, not the headline.

### New additions

- `keywords` array covering both the product ("pay per use AI", "USDC AI", "x402 protocol") and the token ("AIC token", "AIC presale", "on-chain AI")
- `openGraph.siteName: "WebAI3"` — was missing
- `twitter.card: "summary_large_image"` — was missing entirely
- `title.template: "%s | WebAI3"` — inner pages (presale, terms, etc.) now get the site name appended automatically

---

## Rationale

The presale is a mechanism to fund the product, not the product itself. Search snippets, social share previews, and link unfurls should answer "what is this?" before "why should I buy in?" — especially at this stage where brand awareness is zero.

The listing multiple and current phase price are still surfaced in the description so presale-aware visitors get the signal quickly. They're just not the first words someone reads.

---
title: "Landing App Overhaul — Mar 2026"
description: Narrative refactor, section cleanups, and visual polish pass on webai3-landing.
section: Devlog
order: 1
---

## Summary

Full narrative and UI overhaul of `webai3-landing`. The goal was to rebalance the page away from being presale-only toward communicating the application's value first, with the presale as a natural consequence. No backend changes. Commit: `46c0341`.

---

## Sections Changed

### Hero

- Badge rewritten to lead with app value: `"Pay-per-request AI inference · AIC presale live at $0.01"`
- Subtitle now explains the protocol before pitching the token
- "See How It Works" CTA previously linked to `#buy-tokens` — corrected to `#how-it-works`
- Quick buy amounts updated to `[$25, $100, $250, $500]` (added $25 entry)
- "Current Entry Price" and "Step-up Urgency" boxes fused into one compact component
- Presale badge given orange treatment with pulsing dot to stand out

### Presale Hero Card

- Rotating conic border changed from white/slate to orange/amber gradient
- Ambient glow added: `rgba(251, 146, 60, 0.25)`
- All presale-specific accents moved to orange (`text-orange-300`, `bg-orange-500/10`, etc.)

### Sticky Mobile Buy Bar

- Replaced the full panel with a floating pill: `rounded-full px-5 py-2.5`
- Less intrusive, just shows "Buy AIC · $0.01" with an arrow

### Powered By (new — replaces Social Proof)

- `social-proof.tsx` deleted, replaced with `powered-by.tsx`
- Compact strip showing ecosystem links (x402 Protocol, Ethereum, Replicate AI)
- Appends: `"+ more chains, models & integrations coming"`

### Problem → Problem / Solution (combined)

- `problem.tsx` and `solution.tsx` deleted
- New `problem-solution.tsx`: side-by-side terminal cards
  - **BeforeCard** (red): shows today's agent payment failure scenario
  - **AfterCard** (green): shows the same scenario succeeding via x402
  - Desktop: CSS grid side-by-side; Mobile: shadcn `Tabs` component
  - Both cards share the `agent.buy_compute()` narrative for direct comparison

### How It Works

- Replaced static boxes with an auto-advancing vertical stepper
- `shadcn/progress` used as the timer bar (4 s per step)
- Steps have pulsing circles (active), filling green connector lines (completed), check icons (done)
- Pause/Play control
- Removed the simulated code terminal panel — stepper only, centred `max-w-xl`

### Why Buy

- Cut down to: heading + one paragraph + one CTA
- Copy focused on infrastructure investment, no hard numbers

### Tokenomics

- Removed the "Inference payments" tab from `valueFlows` (3 tabs → 2)
- Removed `ArrowRightLeft` import

### Market Timing (Roadmap)

- Removed header subtitle paragraph
- Stage tabs compacted to just phase name + timing label
- Replaced glass detail panel with plain `h3 + p + Separator + ul`
- Dot colors: `bg-foreground` (active) · `bg-foreground/50` (next) · `bg-muted-foreground/35` (planned)

### Team

- Right-hand "Public links" box removed (was empty / placeholder)
- "Join Presale" button inside that box removed
- Content constrained to `max-w-3xl` since the right column is gone
- Section background changed to `bg-muted/20` to break visual monotony

### CTA Section (removed)

- "Join the Presale" `CtaSection` removed from `page.tsx`
- File `cta.tsx` kept but no longer rendered

### Footer

- "Stay updated on Phase 2" banner removed entirely
- Unused `ExternalLink` import cleaned up

### Conclusion (new)

- New `conclusion.tsx` added at the bottom of the page
- Dot grid background + corner glows for visual depth
- Copy addresses developers, investors, and builders — not just presale buyers
- Two CTAs: "Join the presale" (primary) + "Join the community" / "Read the docs" (conditional on site config)

---

## Visual Polish Pass

- **Chart colors**: changed from 4 shades of gray to orange / blue / purple / teal (`--chart-1` through `--chart-4`). Dramatically improves the Advantages bar chart and icon backgrounds.
- **`glow-orange` utility**: was casting a plain black shadow. Now correctly emits `rgba(251, 146, 60, ...)`. Affects Tokenomics card hover.
- **Advantages icon text**: `text-background` was near-black in dark mode on coloured icon backgrounds. Changed to `text-white`.
- **Section rhythm**: Roadmap → Team → PresaleBuy → Vision were all `bg-background`. Team moved to `bg-muted/20`, Vision to `bg-muted/15`.
- **Vision section**: `glow-orange-lg` on the highlight quote card now emits actual orange warmth.

---

## Shadcn Components Installed

| Component | Added for |
|---|---|
| `progress` | How It Works timer bar |
| `tabs` | Problem/Solution mobile view |
| `accordion` | (installed, not yet used) |

---

## Files Deleted

- `src/components/sections/problem.tsx`
- `src/components/sections/solution.tsx`
- `src/components/sections/social-proof.tsx`

## Files Added

- `src/components/sections/powered-by.tsx`
- `src/components/sections/problem-solution.tsx`
- `src/components/sections/conclusion.tsx`
- `src/components/ui/progress.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/accordion.tsx`

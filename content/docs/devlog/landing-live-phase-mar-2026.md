---
title: "Landing: Prices Fix & Live On-Chain Phase"
description: Replacing hardcoded price strings with config-driven values and wiring the active presale phase to getActivePhase() on-chain.
section: Devlog
order: 3
---

## Overview

Two follow-up commits from the March 2026 landing overhaul (commit `46c0341`).

| Commit | Change |
|---|---|
| `1bf3574` | Replace all hardcoded price strings with `presale-config.ts` values |
| `74d7a8d` | Read `WebAI3Presale.getActivePhase()` on-chain at runtime |

---

## Commit 1bf3574 — Hardcoded Prices Fix

Implemented the correction plan documented in [Fix Plan: Hardcoded Prices](/docs/devlog/hardcoded-prices-fix).

Seven files had price strings embedded as literals (`$0.01`, `$0.12`, `12x`). All were replaced with values computed from `presale-config.ts`.

### What changed

**`src/components/header.tsx`**
- Listing target banner: `$0.12` → `${config.listingPriceUsd.toFixed(2)}`
- Buy CTA: `Buy AIC at $0.01` → `Buy AIC at ${current.priceUsd.toFixed(...)}`
- Passes `buyLabel` prop to `MobileNav`

**`src/components/mobile-nav.tsx`**
- Added `buyLabel?: string` prop (default `"Buy AIC"`)
- Replaced literal `"Buy AIC at $0.01"` with `{buyLabel}`

**`src/components/sections/hero.tsx`**
- Made `async` — calls `await getPresaleConfigAsync()`
- Badge, subtitle, and CTA button all use `formatCurrency(current.priceUsd)`

**`src/components/presale/presale-hero-card.tsx`**
- Listing target tile: `$0.12 (12x from Phase 1)` → computed from `config.listingPriceUsd` and `config.phases[0].priceUsd`
- CTA: uses `formatCurrency(current.priceUsd)`

**`src/components/presale/presale-cta-strip.tsx`**
- Made `async` — calls `await getPresaleConfigAsync()`
- Listing target: computed from config

**`src/components/sections/presale-buy.tsx`**
- Made `async` — calls `await getPresaleConfigAsync()`

**`src/components/presale/sticky-mobile-buy-bar.tsx`**
- Made `async` — calls `await getPresaleConfigAsync()`

**`src/components/sections/tokenomics.tsx`**
- Listing target stat: `"$0.12"` → `` `${config.listingPriceUsd.toFixed(2)}` ``

**`src/app/layout.tsx`**
- Metadata title and description now interpolate current phase name, price, and listing multiple

---

## Commit 74d7a8d — Live On-Chain Phase

### Problem

The active presale phase was set via `NEXT_PUBLIC_PRESALE_CURRENT_PHASE_ID` in `.env`. Phase transitions on-chain are automatic (triggered by the presale contract when a phase fills). The env var would lag behind unless manually updated, causing the landing site to show stale phase/price data.

The dashboard already had on-chain phase reads — the landing didn't.

### Solution

Two new files:

**`src/lib/chain-phase.ts`**

```ts
import { cache } from "react";
import { createPublicClient, http } from "viem";
import { mainnet, sepolia } from "viem/chains";

const GET_ACTIVE_PHASE_ABI = [
  { name: "getActivePhase", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint8" }] },
] as const;

function getChain() {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "1");
  return chainId === 11155111 ? sepolia : mainnet;
}

export const getOnChainPhaseIndex = cache(async (): Promise<number | null> => {
  const presaleAddress = process.env.NEXT_PUBLIC_PRESALE_CONTRACT_ADDRESS;
  if (!presaleAddress) return null;
  try {
    const client = createPublicClient({
      chain: getChain(),
      transport: http(process.env.NEXT_PUBLIC_RPC_URL || undefined),
    });
    const phase = await client.readContract({
      address: presaleAddress as `0x${string}`,
      abi: GET_ACTIVE_PHASE_ABI,
      functionName: "getActivePhase",
    });
    return Number(phase);
  } catch {
    return null;
  }
});
```

React `cache()` deduplicates the RPC call — one network request per page render regardless of how many server components call `getPresaleConfigAsync()`.

**`getPresaleConfigAsync()` added to `src/lib/presale-config.ts`**

```ts
export async function getPresaleConfigAsync(): Promise<PresaleConfig> {
  const config = getPresaleConfig();
  const { getOnChainPhaseIndex } = await import("./chain-phase");
  const onChainIndex = await getOnChainPhaseIndex();
  if (onChainIndex !== null && onChainIndex >= 0 && onChainIndex < config.phases.length) {
    return { ...config, currentPhaseId: config.phases[onChainIndex].id };
  }
  return config;
}
```

Falls back to the env var if:
- `NEXT_PUBLIC_PRESALE_CONTRACT_ADDRESS` is not set
- The RPC call throws

### New env vars

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_PRESALE_CONTRACT_ADDRESS` | Yes (for on-chain reads) | `WebAI3Presale` deployed address |
| `NEXT_PUBLIC_CHAIN_ID` | No | Default `1` (mainnet). Set to `11155111` for Sepolia |
| `NEXT_PUBLIC_RPC_URL` | No | Custom RPC endpoint. Omit to use viem's default public node |

### Client component constraint

`header.tsx` is `"use client"` (needs wagmi hooks) so it cannot be made async. The page-level `page.tsx` was made `async` and passes `currentPhaseId` as a prop:

```tsx
// src/app/page.tsx
export default async function HomePage() {
  const config = await getPresaleConfigAsync();
  return (
    <>
      <Header currentPhaseId={config.currentPhaseId} />
      ...
    </>
  );
}
```

`Header` uses the passed `currentPhaseId` as primary source and falls back to the env-var config if the prop is undefined.

---

## Source of Truth — Active Phase

| Scenario | Source |
|---|---|
| `NEXT_PUBLIC_PRESALE_CONTRACT_ADDRESS` set | On-chain `getActivePhase()` return value |
| Contract address not set (dev/staging) | `NEXT_PUBLIC_PRESALE_CURRENT_PHASE_ID` env var |
| Both unset | `phase-1` (first entry in default phase array) |

The env var `NEXT_PUBLIC_PRESALE_CURRENT_PHASE_ID` is now a **fallback**, not the primary source.

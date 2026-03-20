---
title: Token ↔ App Integration
description: How the AIC token connects to the inference app — staking discount implementation, AIC-as-payment, burn mechanics, and access gating.
section: Developer Reference
order: 5
---

The inference app and the AIC token are separate systems that integrate at the payment layer. The connection point is the `IAICStaking` interface: the inference API reads `stakedBalance(userAddress)` before each payment to determine the discount tier.

This document describes the full integration plan across three tiers.

---

## Current State

| Feature | Status |
|---|---|
| USDC payments via x402 | Live |
| AIC staking contract | Not deployed |
| Staking discount in inference API | Not implemented |
| AIC-as-payment option | Not implemented |
| Burn-on-use | Not implemented |
| Access gating by AIC balance | Not implemented |

---

## Tier 1 — Staking Discounts

### Staking Contract Interface

The inference app expects a contract that implements:

```solidity
interface IAICStaking {
    function stakedBalance(address account) external view returns (uint256);
    function stake(uint256 amount) external;
    function unstake(uint256 amount) external;
    function withdraw() external;
}
```

The inference API only reads `stakedBalance()`. The write functions (`stake`, `unstake`, `withdraw`) are called directly by users from the frontend.

### Server-Side Discount Calculation

At inference request time, the server:

1. Reads `IAICStaking.stakedBalance(userAddress)` via viem public client
2. Looks up the discount tier:

```typescript
function getDiscountTier(stakedAic: bigint): number {
  if (stakedAic >= 200_000n * 10n**18n) return 0.50; // 50%
  if (stakedAic >= 50_000n * 10n**18n)  return 0.35; // 35%
  if (stakedAic >= 10_000n * 10n**18n)  return 0.20; // 20%
  if (stakedAic >= 1_000n * 10n**18n)   return 0.10; // 10%
  return 0;
}
```

3. Calculates the effective rate: `baseRate * (1 - discountPct)`
4. Uses the effective rate for cost estimation and the x402 payment requirement

### Database Schema Additions (Tier 1)

```sql
ALTER TABLE inferences ADD COLUMN staked_aic_at_time NUMERIC(30, 18);  -- AIC staked when inference ran
ALTER TABLE inferences ADD COLUMN discount_pct       NUMERIC(5, 2);    -- e.g. 20.00
ALTER TABLE inferences ADD COLUMN effective_rate_usdc NUMERIC(18, 9);  -- discounted $/sec
```

### AIC Balance in the UI

The inference app frontend reads `IAICStaking.stakedBalance(connectedAddress)` to display:
- Current staking tier and discount
- How many more AIC to stake to reach the next tier
- Estimated monthly savings at current usage volume

---

## Tier 1.5 — AIC-as-Payment

The x402 payment protocol supports multiple `accepts` entries in a single payment requirement response. To accept both USDC and AIC:

```json
{
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:1",
      "asset": "0xA0b86991...", // USDC
      "amount": "10000",
      "extra": { ... }
    },
    {
      "scheme": "exact",
      "network": "eip155:1",
      "asset": "AIC_CONTRACT_ADDRESS",
      "amount": "AIC_AMOUNT",
      "extra": { ... }
    }
  ]
}
```

The user's wallet picks whichever asset they want to pay with.

### Requirement: EIP-3009 on AIC

The current `WebAI3Token` only implements EIP-2612 (`permit`). The x402 payment signature uses EIP-3009 (`transferWithAuthorization`), which requires a different interface:

```solidity
function transferWithAuthorization(
    address from,
    address to,
    uint256 value,
    uint256 validAfter,
    uint256 validBefore,
    bytes32 nonce,
    uint8 v, bytes32 r, bytes32 s
) external;
```

Options to add this:
- **Option A:** Deploy a new `WebAI3TokenV2` with EIP-3009 support (requires migrating holders or using a wrapper)
- **Option B:** Deploy a `WrappedAIC` ERC-20 wrapper that adds EIP-3009 (users wrap their AIC to pay)
- **Option C:** Deploy an `AICSplitter` helper contract that accepts AIC and handles the split/burn internally

### AIC Pricing

AIC-as-payment requires a price oracle to quote how much AIC equals $X in USDC:

- **TWAP:** Read AIC/USDC price from the DEX pool (Uniswap v3 TWAP). Most decentralized but adds complexity.
- **Off-chain oracle:** Admin-set AIC price updated periodically via env var. Simpler but centralized.
- **Fixed admin rate:** `AIC_USDC_RATE` env var set manually. Acceptable for early stages.

---

## Tier 2 — Burn-on-Use

When users pay with AIC, a configurable percentage is burned (sent to `address(0)`):

```typescript
const AIC_BURN_BPS = parseInt(process.env.AIC_BURN_BPS ?? "2000"); // default 20%
const burnAmount = aicAmount * AIC_BURN_BPS / 10_000;
const treasuryAmount = aicAmount - burnAmount;
```

This requires an `AICSplitter` contract or a direct `burn()` function on the token. Currently, `WebAI3Token` has no public `burn()` — adding it would require a new deployment.

The burn percentage can be governed by AIC token holders voting via the `ERC20Votes` interface.

### Database Schema Additions (Tier 2)

```sql
ALTER TABLE inferences ADD COLUMN payment_token    TEXT;             -- 'USDC' or 'AIC'
ALTER TABLE inferences ADD COLUMN aic_burned_amount NUMERIC(30, 18); -- AIC burned per inference
```

---

## Tier 2 — Access Gating

Certain model tiers require a minimum AIC balance or stake. The inference API enforces this server-side:

```typescript
const MODEL_TIERS = {
  free:     { minHeld: 0n,     minStaked: 0n },
  standard: { minHeld: 500n * 10n**18n,  minStaked: 0n },
  premium:  { minHeld: 0n,     minStaked: 5_000n * 10n**18n },
};

async function checkModelAccess(model: string, address: string) {
  const tier = getModelTier(model);
  if (tier === 'free') return true;

  const balance  = await aicToken.read.balanceOf([address]);
  const staked   = await stakingContract.read.stakedBalance([address]);

  if (tier === 'standard' && balance >= MODEL_TIERS.standard.minHeld) return true;
  if (tier === 'premium'  && staked  >= MODEL_TIERS.premium.minStaked)  return true;
  return false;
}
```

The inference API (`/api/inference`) checks access before returning the 402 Payment Required response. If access is denied, it returns 403.

---

## Implementation Order

The recommended sequence to avoid blocking dependencies:

```
1. Deploy IAICStaking contract
2. Add STAKING_CONTRACT_ADDRESS to webai3_web env
3. Add stakedBalance read to inference API
4. Apply discount tier logic to cost calculation
5. Show AIC balance + tier in frontend
6. Upgrade or wrap AIC token for EIP-3009 (for AIC-as-payment)
7. Add AIC price feed / oracle
8. Add AIC to x402 accepts[] array
9. Deploy AICSplitter, configure burn BPS
10. Add access gating per model tier
11. Govern burn rate + thresholds via AIC token votes
```

---
title: Fund Routing & Vaults
description: Complete reference for the PresaleVault router and all four sub-vaults (Liquidity, DevRunway, TeamStream, Marketing), plus the ClaimModule vesting contract.
section: Developer Reference
order: 4
---

Every USDC contribution routes atomically through `PresaleVault` and splits across four sub-vaults at purchase time. No funds ever sit in the presale contract itself.

---

## PresaleVault

**Source:** `webai3_token/src/presale/PresaleVault.sol`

The router. Called by `WebAI3Presale.buyTokens()` after USDC is transferred.

### Split Constants

```solidity
uint256 public constant LIQUIDITY_BPS = 7_000;  // 70%
uint256 public constant DEV_BPS       = 1_500;  // 15%
uint256 public constant TEAM_BPS      = 1_000;  // 10%
// marketing gets remainder = 10_000 - 7000 - 1500 - 1000 = 500 BPS (5%)
uint256 public constant BPS_DENOMINATOR = 10_000;
```

### `routeDeposit(uint256 usdcAmount, uint256 totalRaisedAfter)`

Called by presale, only callable by presale:

```
liquidity = (usdcAmount * LIQUIDITY_BPS) / BPS_DENOMINATOR
dev       = (usdcAmount * DEV_BPS)       / BPS_DENOMINATOR
team      = (usdcAmount * TEAM_BPS)      / BPS_DENOMINATOR
marketing = usdcAmount - liquidity - dev - team   // catches rounding dust
```

Each amount is transferred to the respective vault via `safeTransfer`, then the vault's `onDeposit()` callback is called.

### `onPresaleFinalized(uint64 finalizedAt)`

Called by presale on finalization. Propagates `finalizedAt` to `LiquidityVault` and `MarketingVault`. Does not affect `DevRunwayVault` or `TeamStreamVault` (they use their own start timestamps).

### `liquidityProvisioned() → bool`

Delegates to `LiquidityVault.liquidityProvisioned()`. Used by `ClaimModule.enableClaims()` to gate claim access.

---

## LiquidityVault

**Source:** `webai3_token/src/presale/LiquidityVault.sol`

Holds 70% of all presale USDC. Transfers the entire balance to a fixed `liquidityRecipient` address via one of two paths.

### Key State

```solidity
address public immutable liquidityRecipient; // fixed at deployment
bool public presaleFinalized;
bool public liquidityProvisioned;
uint64 public finalizedAt;
uint256 public totalDeposited;
```

### Deposit

```solidity
function onDeposit(uint256 amount) external onlyPresaleVault
```

Increments `totalDeposited`. Emits `LiquidityDeposited`.

### Provisioning — Two Paths

```solidity
// Path A: operator-gated, window-bounded
function provideLiquidity() external onlyRole(LIQUIDITY_OPERATOR_ROLE) nonReentrant

// Path B: permissionless fallback
function provideLiquidityFallback() external nonReentrant
```

| | Path A | Path B |
|---|---|---|
| Who can call | `LIQUIDITY_OPERATOR_ROLE` | Anyone |
| When | `finalizedAt ≤ now ≤ finalizedAt + 7 days` | `now > finalizedAt + 7 days` |
| What it does | Transfers full USDC balance to `liquidityRecipient` | Same |

Both paths call `_executeProvision(viaFallback)` which:
1. Reads the vault's USDC balance
2. Validates balance > 0
3. Transfers all USDC to `liquidityRecipient`
4. Sets `liquidityProvisioned = true`
5. Emits `LiquidityProvisionedEvent(caller, amount, viaFallback)`

`liquidityProvisioned` is a one-way flag. Both paths can execute exactly once.

### Boundary Behavior

At exactly `finalizedAt + 7 days`: `provideLiquidity()` succeeds, `provideLiquidityFallback()` reverts.
At `finalizedAt + 7 days + 1 second`: `provideLiquidity()` reverts, `provideLiquidityFallback()` succeeds.

---

## DevRunwayVault

**Source:** `webai3_token/src/presale/DevRunwayVault.sol`

Holds 15% of presale USDC. Releases funds via a time-based stream, not a lump sum.

### Key Constants

```solidity
uint256 public constant DEV_STREAM_DURATION = 180 days;
uint256 public constant DEV_MAX_BUDGET = 1_050_000e6; // 15% × 7M hard cap
```

### Key State

```solidity
address public immutable beneficiary;
uint64 public immutable presaleStartTimestamp;
uint256 public totalDeposited;
uint256 public totalWithdrawn;
```

### Stream Formula

```solidity
function streamedDevAmount() public view returns (uint256) {
    if (block.timestamp <= presaleStartTimestamp) return 0;
    uint256 elapsed = block.timestamp - presaleStartTimestamp;
    if (elapsed >= DEV_STREAM_DURATION) return DEV_MAX_BUDGET;
    return (DEV_MAX_BUDGET * elapsed) / DEV_STREAM_DURATION;
}
```

### Withdrawable Amount

```solidity
function withdrawableDev() public view returns (uint256) {
    uint256 streamed = streamedDevAmount();
    uint256 cap = streamed < totalDeposited ? streamed : totalDeposited;
    if (cap <= totalWithdrawn) return 0;
    return cap - totalWithdrawn;
}
```

The dual gate: `min(streamedDevAmount(), totalDeposited) - totalWithdrawn`. Even if the presale raises the full $7M quickly, the time stream constrains withdrawals to the proportional amount over 180 days.

**Example:** At `presaleStart + 30 days`, the stream has unlocked `1_050_000 × (30/180) = 175,000 USDC`. If 200,000 USDC has been deposited (from a fast-starting presale), `withdrawableDev = 175,000`.

### Withdrawal

```solidity
function withdraw(uint256 amount) external onlyRole(DEV_OPERATOR_ROLE) nonReentrant
```

Transfers to `beneficiary` (not `msg.sender`). Increments `totalWithdrawn`.

---

## TeamStreamVault

**Source:** `webai3_token/src/presale/TeamStreamVault.sol`

Holds 10% of presale USDC. Pure linear stream from `streamStartTimestamp` over `streamDuration`.

### Key State

```solidity
address public immutable beneficiary;
uint64 public immutable streamStartTimestamp;
uint256 public immutable streamDuration; // e.g. 365 days
uint256 public totalDeposited;
uint256 public totalWithdrawn;
```

### Stream Formula

```solidity
function streamedAmount() public view returns (uint256) {
    if (block.timestamp <= streamStartTimestamp) return 0;
    uint256 elapsed = block.timestamp - streamStartTimestamp;
    if (elapsed >= streamDuration) return totalDeposited;
    return (totalDeposited * elapsed) / streamDuration;
}

function withdrawableAmount() public view returns (uint256) {
    uint256 streamed = streamedAmount();
    if (streamed <= totalWithdrawn) return 0;
    return streamed - totalWithdrawn;
}
```

Unlike `DevRunwayVault`, there is no max budget constant — it streams proportionally against the actual deposited amount.

### Withdrawal

```solidity
function withdraw(uint256 amount) external onlyRole(TEAM_OPERATOR_ROLE) nonReentrant
```

Transfers to `beneficiary`. Increments `totalWithdrawn`.

---

## MarketingVault

**Source:** `webai3_token/src/presale/MarketingVault.sol`

Holds 5% of presale USDC. Locked until finalization, then requires a timelock queue.

### Key State

```solidity
address public immutable beneficiary;
uint256 public immutable withdrawalDelay; // e.g. 2 days
bool public presaleFinalized;
uint64 public finalizedAt;
uint256 public totalDeposited;
uint256 public totalWithdrawn;
uint256 public pendingWithdrawalAmount;
uint64 public pendingWithdrawalReadyAt;
```

### Finalization Hook

```solidity
function onPresaleFinalized(uint64 finalizedAt_) external onlyPresaleVault
```

Sets `presaleFinalized = true`. Called by `PresaleVault.onPresaleFinalized()`. Before this: no withdrawals possible (reverts `MarketingLocked()`).

### Two-Step Withdrawal

```solidity
// Step 1 — queue (post-finalization only)
function queueWithdrawal(uint256 amount) external onlyRole(MARKETING_OPERATOR_ROLE)
// validates: presaleFinalized, amount > 0, no pending withdrawal, amount <= availableBalance()
// sets: pendingWithdrawalAmount = amount
//       pendingWithdrawalReadyAt = block.timestamp + withdrawalDelay

// Step 2 — execute (after timelock)
function executeWithdrawal() external onlyRole(MARKETING_OPERATOR_ROLE) nonReentrant
// validates: pendingWithdrawalAmount > 0, block.timestamp >= pendingWithdrawalReadyAt
// transfers to beneficiary, clears pending fields

// Safety valve
function cancelQueuedWithdrawal() external onlyRole(MARKETING_OPERATOR_ROLE)
```

Exactly at `pendingWithdrawalReadyAt`: `executeWithdrawal()` succeeds (uses `>=`).

---

## ClaimModule

**Source:** `webai3_token/src/presale/ClaimModule.sol`

Holds the full 500M AIC presale allocation. Records allocations as buyers purchase. Releases AIC on a 3-tranche vesting schedule.

### Key Constants

```solidity
uint256 public constant PRESALE_TOKEN_CAP = 500_000_000 ether;
uint256 public constant BPS_DENOMINATOR = 10_000;
uint256 public constant TGE_BPS = 3_000;         // 30%
uint256 public constant TGE_PLUS_3M_BPS = 6_500; // 65%
uint256 public constant FULLY_VESTED_BPS = 10_000;// 100%
```

### Vesting Timestamps (Immutable)

```solidity
uint64 public immutable tgeTimestamp;
uint64 public immutable tgePlus3Months;  // tgeTimestamp + 90 days
uint64 public immutable tgePlus6Months;  // tgeTimestamp + 180 days
```

### State

```solidity
IWebAI3PresaleState public presale;
bool public claimsEnabled;
uint256 public totalRecordedAllocations;
mapping(address => uint256) public totalAllocation;
mapping(address => uint256) public totalClaimed;
```

### `recordAllocation(address buyer, uint256 amount)`

Called by `WebAI3Presale.buyTokens()`. Only callable by the presale contract. Validates `totalRecordedAllocations + amount <= PRESALE_TOKEN_CAP`, then increments both the global and per-buyer counters.

### `enableClaims()`

Permissionless. Callable by anyone once both conditions are true:

```solidity
require(presale.presaleFinalized(), ...);
require(presale.liquidityProvisioned(), ...);
claimsEnabled = true;
```

### `vestedBps() → uint256`

```
if now < tgeTimestamp:         return 0
if now < tgePlus3Months:       return 3_000  (30%)
if now < tgePlus6Months:       return 6_500  (65%)
else:                          return 10_000 (100%)
```

> **Note:** Vesting is step-function, not linear between milestones. The unlock jumps at each checkpoint.

### `claimableAmount(address user) → uint256`

```
vested = totalAllocation[user] * vestedBps() / BPS_DENOMINATOR
return vested - totalClaimed[user]  (or 0 if underflow)
```

### `claim() → uint256 amount`

```solidity
function claim() external nonReentrant returns (uint256 amount)
```

1. Validates `claimsEnabled`, `presaleFinalized`, `liquidityProvisioned`
2. Computes `claimableAmount(msg.sender)`
3. Reverts `NothingClaimable()` if amount is 0
4. Increments `totalClaimed[msg.sender]`
5. Transfers AIC to `msg.sender`
6. Emits `TokensClaimed`

---

## Routing Invariant

Every USDC deposited in the presale routes exactly as follows. This is verifiable on-chain:

```
totalRoutedUSDC (PresaleVault) == totalRaisedUSDC (WebAI3Presale)

LiquidityVault.totalDeposited +
DevRunwayVault.totalDeposited +
TeamStreamVault.totalDeposited +
MarketingVault.totalDeposited  == totalRoutedUSDC
```

The test suite explicitly validates this accounting invariant end-to-end.

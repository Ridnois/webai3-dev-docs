---
title: Presale System
description: Complete technical reference for WebAI3Presale.sol — phase model, buy flow, finalization, pause mechanism, state machine, and all events and errors.
section: Developer Reference
order: 3
---

`WebAI3Presale` is the main presale contract. It manages 7 pricing phases, coordinates with the vault router and claim module, and exposes permissionless finalization.

**Source:** `webai3_token/src/WebAI3Presale.sol`

---

## Constants

```solidity
bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

uint256 public constant HARD_CAP = 7_000_000e6;           // 7M USDC (6 decimals)
uint256 public constant PRESALE_TOKEN_CAP = 500_000_000 ether; // 500M AIC
uint256 public constant MAX_SINGLE_PAUSE = 72 hours;
uint256 public constant MAX_CUMULATIVE_PAUSE = 14 days;
uint8   public constant PHASE_COUNT = 7;
```

---

## Data Structures

```solidity
enum Lifecycle {
    Pending,    // block.timestamp < PRESALE_START_TIMESTAMP
    Active,     // within window, not paused, not finalizable
    Paused,     // pause active
    Ended,      // finalizable but not yet finalized
    Finalized   // presaleFinalized == true
}

struct Phase {
    uint256 cumulativeRaiseCapUSDC; // cumulative USDC ceiling for this phase
    uint256 pricePerTokenUSDC6;     // price in USDC × 10^6 (so $0.01 = 10_000)
    uint256 tokenCap;               // max AIC tokens allocatable in this phase
    uint256 soldTokens;             // tokens allocated so far in this phase
}
```

---

## Phase Configuration

```
Phase 0: cumCap=$500k,  price=10_000 ($0.010), tokenCap=50M
Phase 1: cumCap=$1M,    price=13_000 ($0.013), tokenCap=38.5M
Phase 2: cumCap=$2M,    price=20_000 ($0.020), tokenCap=50M
Phase 3: cumCap=$3.5M,  price=28_000 ($0.028), tokenCap=53.6M
Phase 4: cumCap=$5M,    price=38_000 ($0.038), tokenCap=39.5M
Phase 5: cumCap=$6M,    price=53_000 ($0.053), tokenCap=18.9M
Phase 6: cumCap=$7M,    price=70_000 ($0.070), tokenCap=249.5M
```

The sum of all token caps exactly equals `PRESALE_TOKEN_CAP` (500M AIC). This invariant is validated in `_initializePhases()` and the constructor reverts if it doesn't hold.

### Phase advancement logic

`getActivePhase()` iterates from phase 0 upward and returns the first phase where `totalRaisedUSDC < phase.cumulativeRaiseCapUSDC`:

```solidity
function getActivePhase() public view returns (uint8) {
    if (presaleFinalized) return type(uint8).max;
    if (block.timestamp < PRESALE_START_TIMESTAMP) return type(uint8).max;
    if (block.timestamp >= PRESALE_END_TIMESTAMP) return type(uint8).max;
    if (totalRaisedUSDC >= HARD_CAP) return type(uint8).max;

    for (uint8 i = 0; i < PHASE_COUNT; i++) {
        if (totalRaisedUSDC < _phases[i].cumulativeRaiseCapUSDC) return i;
    }
    return type(uint8).max; // all phases exhausted
}
```

Phase transitions happen mid-transaction. A purchase that would push `totalRaisedUSDC` past a phase boundary uses the current phase's price for the entire amount.

---

## Immutable State

```solidity
IERC20 public immutable usdc;
IPresaleVault public immutable presaleVault;
IClaimModule public immutable claimModule;
uint64 public immutable PRESALE_START_TIMESTAMP;
uint64 public immutable PRESALE_END_TIMESTAMP;
```

All set in constructor. `PRESALE_END_TIMESTAMP` cannot be changed post-deployment.

---

## Mutable State

```solidity
bool public presaleFinalized;
bool internal _pauseActive;
uint64 internal currentPauseStartedAt;
uint256 public cumulativePausedDuration;

uint256 public totalRaisedUSDC;
uint256 public totalAllocatedTokens;
mapping(address => uint256) public contributions;    // USDC per buyer
mapping(address => uint256) public tokenAllocations; // AIC per buyer

Phase[PHASE_COUNT] internal _phases;
```

---

## Core Functions

### `buyTokens(uint256 usdcAmount) → uint256 aicAmount`

```solidity
function buyTokens(uint256 usdcAmount) external nonReentrant returns (uint256 aicAmount)
```

**Validation (reverts with custom error if any fail):**

| Check | Error |
|---|---|
| `usdcAmount > 0` | `ZeroAmount()` |
| `!presaleFinalized` | `PresaleAlreadyFinalized()` |
| `block.timestamp >= PRESALE_START_TIMESTAMP` | `PresaleNotStarted()` |
| `block.timestamp < PRESALE_END_TIMESTAMP` | `PresaleEnded()` |
| `!_pauseActive` | `PresaleNotActive()` |
| Phase exists | `NoActivePhase()` |
| `totalRaisedUSDC + usdcAmount <= HARD_CAP` | `HardCapExceeded()` |
| `phase.soldTokens + aicAmount <= phase.tokenCap` | `PhaseCapExceeded()` |
| `totalAllocatedTokens + aicAmount <= PRESALE_TOKEN_CAP` | `AllocationCapExceeded()` |

**Pricing:**
```
aicAmount = (usdcAmount * 1e18) / pricePerTokenUSDC6
```

This rounds down (Solidity integer division). Buyers receive fewer tokens on fractional amounts. The rounding ensures `totalAllocatedTokens` never exceeds the cap due to arithmetic artifacts.

**Execution sequence:**
1. Look up active phase
2. Compute `aicAmount`
3. Run all cap checks
4. `usdc.transferFrom(msg.sender, address(presaleVault), usdcAmount)`
5. `presaleVault.routeDeposit(usdcAmount, totalRaisedUSDC + usdcAmount)`
6. `claimModule.recordAllocation(msg.sender, aicAmount)`
7. Update accounting: `totalRaisedUSDC`, `totalAllocatedTokens`, `contributions`, `tokenAllocations`, `phase.soldTokens`
8. Emit `TokensPurchased`
9. If phase boundary crossed: emit `PhaseAdvanced`

### `finalizePresale()`

```solidity
function finalizePresale() external nonReentrant
```

Permissionless. Callable by any address once `isFinalizable()` returns true.

```solidity
function isFinalizable() public view returns (bool) {
    return (totalRaisedUSDC >= HARD_CAP) || (block.timestamp >= PRESALE_END_TIMESTAMP);
}
```

**Execution:**
1. Validate `!presaleFinalized` and `isFinalizable()`
2. If `_pauseActive`, call `_liftPause(false)` (auto-lift the pause)
3. Set `presaleFinalized = true`
4. Call `presaleVault.onPresaleFinalized(uint64(block.timestamp))`
5. Emit `PresaleFinalized`

### `pause()` / `unpause()` / `forceUnpause()`

```solidity
function pause() external onlyRole(PAUSER_ROLE)
function unpause() external onlyRole(PAUSER_ROLE)
function forceUnpause() external  // permissionless after 72h
```

**`pause()` validates:**
- `!presaleFinalized`
- `!_pauseActive`
- `block.timestamp < PRESALE_END_TIMESTAMP`
- `cumulativePausedDuration < MAX_CUMULATIVE_PAUSE`

**`forceUnpause()` validates:**
- `_pauseActive`
- `block.timestamp >= currentPauseStartedAt + MAX_SINGLE_PAUSE`

**`_liftPause(bool forced)` (internal):**
```
elapsed = block.timestamp - currentPauseStartedAt
elapsed = min(elapsed, MAX_CUMULATIVE_PAUSE - cumulativePausedDuration)
cumulativePausedDuration += elapsed
_pauseActive = false
currentPauseStartedAt = 0
emit PauseLifted(...)
```

---

## View Functions

```solidity
function lifecycle() public view returns (Lifecycle)
function isFinalizable() public view returns (bool)
function pauseActive() external view returns (bool)
function getActivePhase() public view returns (uint8)
function getPhaseInfo(uint8 phaseIndex) external view returns (
    uint256 cumulativeRaiseCapUSDC,
    uint256 pricePerTokenUSDC6,
    uint256 tokenCap,
    uint256 soldTokens,
    uint256 remainingTokens
)
function remainingHardCapUSDC() external view returns (uint256)
function liquidityProvisioned() public view returns (bool) // delegates to presaleVault
```

---

## Events

```solidity
event TokensPurchased(
    address indexed buyer,
    uint256 usdcAmount,
    uint256 aicAmount,
    uint8 indexed phaseIndex,
    uint256 totalRaisedAfter
);

event PhaseAdvanced(
    uint8 indexed previousPhase,
    uint8 indexed nextPhase,
    uint256 nextPriceUSDC6
);

event PresaleFinalized(
    uint64 indexed finalizedAt,
    uint256 totalRaisedUSDC,
    uint256 totalAllocatedTokens
);

event PauseActivated(
    address indexed by,
    uint64 indexed startedAt,
    uint256 cumulativePausedDuration
);

event PauseLifted(
    address indexed by,
    uint64 indexed endedAt,
    uint256 elapsed,
    uint256 cumulativePausedDuration,
    bool forced
);
```

---

## Custom Errors (full list)

```solidity
// General
error InvalidAddress()
error InvalidTimestamp()
error InvalidConfiguration()
error AlreadyConfigured()
error NotAuthorized()
error ZeroAmount()

// Presale lifecycle
error PresaleNotActive()
error PresaleAlreadyFinalized()
error PresaleNotFinalized()
error PresaleNotStarted()
error PresaleEnded()
error PresaleNotFinalizable()

// Pause system
error PauseAlreadyActive()
error PauseNotActive()
error PauseBudgetExceeded()
error ForceUnpauseUnavailable()

// Phase and cap enforcement
error HardCapExceeded()
error NoActivePhase()
error PhaseCapExceeded()
error AllocationCapExceeded()

// Claims
error ClaimsNotEnabled()
error NothingClaimable()
error LiquidityNotProvisioned()
error LiquidityAlreadyProvisioned()
error LiquidityWindowExpired()
error LiquidityFallbackNotAvailable()
error LiquidityExecutionFailed()

// Vault
error MarketingLocked()
error TimelockNotReady()
error NoQueuedWithdrawal()
error WithdrawalExceedsLimit()
```

---

## State Machine

```
                 ┌─────────┐
                 │ Pending  │  block.timestamp < START
                 └────┬─────┘
                      │ time passes
                      ▼
                 ┌─────────┐
          ┌─────▶│  Active  │◀────────────────────┐
          │      └────┬─────┘                     │
          │           │ pause()                   │ unpause() / forceUnpause()
          │           ▼                           │
          │      ┌─────────┐                      │
          │      │  Paused  │─────────────────────┘
          │      └─────────┘
          │
          │  (any state where isFinalizable())
          │           │
          │           ▼
          │      ┌─────────┐
          │      │  Ended   │  finalizable, not yet finalized
          │      └────┬─────┘
          │           │ finalizePresale()
          │           ▼
          │      ┌───────────┐
          └──────│ Finalized  │  presaleFinalized == true
                 └───────────┘
```

---

## Key Boundary Behaviors (From Tests)

| Scenario | Behavior |
|---|---|
| Buy that exactly hits phase cumulative cap | Succeeds, next buy starts new phase |
| Buy that exactly hits HARD_CAP | Succeeds; `totalRaisedUSDC == HARD_CAP` → finalizable |
| Buy that exceeds phase token cap by 1 wei | Reverts `PhaseCapExceeded()` |
| Buy that exceeds PRESALE_TOKEN_CAP by 1 wei | Reverts `AllocationCapExceeded()` |
| Force unpause at exactly 72h | Succeeds (uses `>=` comparison) |
| Force unpause at 72h - 1s | Reverts `ForceUnpauseUnavailable()` |
| Pause at exactly cumulative cap (14d) | Reverts `PauseBudgetExceeded()` |
| Finalize at exactly PRESALE_END_TIMESTAMP | Succeeds |

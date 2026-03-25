---
title: Mainnet Deploy Plan
description: Complete technical assessment of deploy_presale_mainnet.sh — all 40 transactions, address registry, constructor arguments, role matrix, irreversibility map, gas budget, and recovery procedures.
section: Operations
order: 3
---


**Script:** `deploy_presale_mainnet.sh`
**Chain:** Ethereum Mainnet (Chain ID `1`)
**Compiler:** Solidity `0.8.24`, Optimizer `20,000` runs
**Framework:** Foundry (`forge`, `cast`)
**Total contracts:** 8
**Total transactions:** 30 (8 deploys + 6 wiring + 5 role grants + 1 token transfer + 10 admin handoff)

---

## Table of Contents

1. [Address Registry](#1-address-registry)
2. [Execution Modes](#2-execution-modes)
3. [Step-by-Step Execution](#3-step-by-step-execution)
4. [Transaction Manifest](#4-transaction-manifest)
5. [Role Assignment Matrix](#5-role-assignment-matrix)
6. [Constructor Arguments Reference](#6-constructor-arguments-reference)
7. [Verification Checklist](#7-verification-checklist)
8. [Irreversibility Map](#8-irreversibility-map)
9. [Gas Budget](#9-gas-budget)
10. [Recovery Procedures](#10-recovery-procedures)

---

## 1. Address Registry

### 1.1 Pre-Deployed External Contracts

| Contract | Address | Notes |
|---|---|---|
| **USDC (Circle)** | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | ERC-20, 6 decimals, immutable |

### 1.2 Deployer EOA

| Role | Address | Source |
|---|---|---|
| **DEPLOYER** | `0x7F13972C13ab207921Db2D6688283CC65923FdeA` | PRESALE_SEED Account #1 |

The deployer EOA signs all deployment transactions and holds temporary `DEFAULT_ADMIN_ROLE` on every contract during the wiring phase. After step 13, this address permanently loses all roles and becomes a regular EOA with no privileged access.

### 1.3 Gnosis Safe Multisigs

| Safe | Address | Threshold | Purpose |
|---|---|---|---|
| **Admin Safe** | `0x880512aF8aE2Bd44108E6155632b11329C952D1F` | 4-of-6 | Holds `DEFAULT_ADMIN_ROLE` on all 8 contracts post-handoff |
| **Pause Safe** | `0xd2F4185057c0709F19CB74f2E35e954234E9cCeC` | 2-of-3 | Holds `PAUSER_ROLE` on WebAI3Token + WebAI3Presale |
| **Ops Safe** | `0xBF948c29EeF3D72B960993217dF77f07EC147065` | 2-of-3 | Holds all operator roles (liquidity, dev, team, marketing) |
| **Treasury Safe** | `0xfC93939aa7a0c744e3e5A438AC530268f27ea041` | 3-of-5 | Immutable beneficiary/recipient for all vault fund flows |

### 1.4 Operator Assignments (via .env.mainnet)

| Variable | Assigned To | Safe |
|---|---|---|
| `PAUSER` | `0xd2F4185057c0709F19CB74f2E35e954234E9cCeC` | Pause Safe |
| `LIQUIDITY_OPERATOR` | `0xBF948c29EeF3D72B960993217dF77f07EC147065` | Ops Safe |
| `DEV_OPERATOR` | `0xBF948c29EeF3D72B960993217dF77f07EC147065` | Ops Safe |
| `TEAM_OPERATOR` | `0xBF948c29EeF3D72B960993217dF77f07EC147065` | Ops Safe |
| `MARKETING_OPERATOR` | `0xBF948c29EeF3D72B960993217dF77f07EC147065` | Ops Safe |

### 1.5 Beneficiary Assignments (immutable at deploy)

| Variable | Assigned To | Safe |
|---|---|---|
| `DEV_BENEFICIARY` | `0xfC93939aa7a0c744e3e5A438AC530268f27ea041` | Treasury Safe |
| `TEAM_BENEFICIARY` | `0xfC93939aa7a0c744e3e5A438AC530268f27ea041` | Treasury Safe |
| `MARKETING_BENEFICIARY` | `0xfC93939aa7a0c744e3e5A438AC530268f27ea041` | Treasury Safe |
| `LIQUIDITY_RECIPIENT` | `0xfC93939aa7a0c744e3e5A438AC530268f27ea041` | Treasury Safe |

### 1.6 Token Allocation Recipients

All genesis allocations go to the deployer EOA `0x7F13972C13ab207921Db2D6688283CC65923FdeA` for initial custody. 500M AIC are transferred to ClaimModule in step 11. The remaining 500M stay with the deployer for treasury, team, investors, incentives, and liquidity allocations.

| Variable | Address | Allocation |
|---|---|---|
| `TOKEN_ADMIN` | `0x7F13972C13ab207921Db2D6688283CC65923FdeA` | Receives `DEFAULT_ADMIN_ROLE` + `PAUSER_ROLE` |
| `TOKEN_TREASURY` | `0x7F13972C13ab207921Db2D6688283CC65923FdeA` | 150,000,000 AIC |
| `TOKEN_COMMUNITY` | `0x7F13972C13ab207921Db2D6688283CC65923FdeA` | 350,000,000 AIC |
| `TOKEN_INVESTORS` | `0x7F13972C13ab207921Db2D6688283CC65923FdeA` | 150,000,000 AIC |
| `TOKEN_TEAM` | `0x7F13972C13ab207921Db2D6688283CC65923FdeA` | 200,000,000 AIC |
| `TOKEN_INCENTIVES` | `0x7F13972C13ab207921Db2D6688283CC65923FdeA` | 100,000,000 AIC |
| `TOKEN_LIQUIDITY` | `0x7F13972C13ab207921Db2D6688283CC65923FdeA` | 50,000,000 AIC |

**Total:** 1,000,000,000 AIC (1B tokens, `10^27` base units at 18 decimals)

---

## 2. Execution Modes

The script supports 5 modes via environment variables:

| Mode | Command | Behavior |
|---|---|---|
| **Full deploy** | `bash deploy_presale_mainnet.sh` | Deploy all contracts, wire, grant roles, fund, verify, admin handoff |
| **Dry run** | `DRY_RUN=1 bash deploy_presale_mainnet.sh` | Simulate only, no transactions broadcast |
| **Skip token** | `SKIP_TOKEN=1 bash deploy_presale_mainnet.sh` | Reuse existing AIC token (set `AIC_TOKEN` in env) |
| **Verify only** | `VERIFY_ONLY=1 bash deploy_presale_mainnet.sh` | Skip deployment, verify existing contracts from `deployed.mainnet.presale.env` |
| **Skip Etherscan** | `SKIP_VERIFY=1 bash deploy_presale_mainnet.sh` | Skip Etherscan source verification (for local Anvil testing) |
| **CI mode** | `CI=1 bash deploy_presale_mainnet.sh` | Bypass both interactive confirmation gates ("DEPLOY" and "TRANSFER") |

### Confirmation Gates

The script has two interactive confirmation points that halt execution until the operator types the exact string:

1. **Gate 1 (before step 5):** Type `DEPLOY` to confirm contract deployment
2. **Gate 2 (before step 13d):** Type `TRANSFER` to confirm irreversible admin handoff to multisigs

Both gates are bypassed when `CI=1` or `DRY_RUN=1`.

---

## 3. Step-by-Step Execution

### Step 1 — Load Environment

**Source:** `.env.mainnet`
**Action:** Sources all configuration variables and recomputes timestamps fresh.

| Parameter | Formula | Value |
|---|---|---|
| `PRESALE_START` | `now + 300s` | ~5 minutes after deploy begins |
| `PRESALE_END` | `PRESALE_START + 120 days` | 120-day presale window |
| `TGE` | `PRESALE_END + 1 day` | Token Generation Event |
| `TEAM_STREAM_DURATION` | `365 days` | 31,536,000 seconds |
| `MARKETING_WITHDRAW_DELAY` | `2 days` | 172,800 seconds |

**Validation:** Requires `MAINNET_RPC_URL`, `PRIVATE_KEY`, `DEPLOYER`, `ETHERSCAN_API_KEY` (unless `SKIP_VERIFY=1`), and `USDC` to be set.

### Step 2 — Check Prerequisites

Verifies that `forge`, `cast`, `jq`, and `python3` are installed and reports their versions.

### Step 3 — Preflight Checks

| Check | Condition | Failure |
|---|---|---|
| Chain ID | Must be `1` | Die with wrong chain error |
| Deployer ETH balance | Must be >= `0.05 ETH` | Die with insufficient balance |
| USDC decimals | Must be `6` | Die with wrong decimals |
| Gas price | Informational only | Logged for cost estimation |
| Block number | Informational only | Logged for audit trail |

### Step 4 — Build Contracts

Runs `forge clean` + `forge build` to compile all 83 Solidity files with `solc 0.8.24` and optimizer at 20,000 runs. Aborts if compilation fails.

**CONFIRMATION GATE 1:** Operator must type `DEPLOY` to continue.

### Step 5 — Deploy AIC Token

**Method:** `forge script script/DeployWebAI3Token.s.sol --broadcast --slow`

The Foundry deployment script reads environment variables and creates a `WebAI3Token` contract with the following constructor call:

```solidity
new WebAI3Token(admin, allocations)
```

Where `admin` = `TOKEN_ADMIN` (`0x7F13972C13ab207921Db2D6688283CC65923FdeA`) and `allocations` is:

| Index | Recipient Variable | Amount | Percentage |
|---|---|---|---|
| 0 | `TOKEN_COMMUNITY` | 350,000,000 AIC | 35% |
| 1 | `TOKEN_TEAM` | 200,000,000 AIC | 20% |
| 2 | `TOKEN_INVESTORS` | 150,000,000 AIC | 15% |
| 3 | `TOKEN_TREASURY` | 150,000,000 AIC | 15% |
| 4 | `TOKEN_INCENTIVES` | 100,000,000 AIC | 10% |
| 5 | `TOKEN_LIQUIDITY` | 50,000,000 AIC | 5% |

**Constructor effects:**
- Mints exactly `1,000,000,000 * 10^18` base units across all allocations
- Grants `DEFAULT_ADMIN_ROLE` to `admin`
- Grants `PAUSER_ROLE` to `admin`
- Reverts if allocations don't sum to `MAX_SUPPLY` or any recipient is `address(0)`

**Post-deploy extraction:** The deployed contract address is read from `broadcast/DeployWebAI3Token.s.sol/1/run-latest.json` via `jq`. The script clears stale broadcast data before deploying to avoid reading old addresses.

**Gas estimate:** ~2,750,000 gas (~3,574,125 with overhead)

### Step 6 — Deploy Presale Contracts (7 contracts)

All 7 contracts are deployed sequentially via `forge create --broadcast --json`. Each deployment captures the deployed address, transaction hash, and gas used.

#### 6a. LiquidityVault

```
forge create src/presale/LiquidityVault.sol:LiquidityVault \
  --constructor-args $DEPLOYER $USDC $LIQUIDITY_RECIPIENT
```

| Parameter | Value | Purpose |
|---|---|---|
| `admin` | `0x7F13972C13ab207921Db2D6688283CC65923FdeA` | Initial `DEFAULT_ADMIN_ROLE` holder |
| `usdc` | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | USDC token address (immutable) |
| `recipient` | `0xfC93939aa7a0c744e3e5A438AC530268f27ea041` | Treasury Safe — receives 70% of presale USDC (immutable) |

**Behavior:** Receives 70% of presale USDC via PresaleVault routing. Operator calls `provideLiquidity()` within 7 days of presale finalization. Permissionless fallback `provideLiquidityFallback()` available after 7 days.

#### 6b. DevRunwayVault

```
forge create src/presale/DevRunwayVault.sol:DevRunwayVault \
  --constructor-args $DEPLOYER $USDC $DEV_BENEFICIARY $PRESALE_START
```

| Parameter | Value | Purpose |
|---|---|---|
| `admin` | `0x7F13972C13ab207921Db2D6688283CC65923FdeA` | Initial `DEFAULT_ADMIN_ROLE` holder |
| `usdc` | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | USDC token address (immutable) |
| `beneficiary` | `0xfC93939aa7a0c744e3e5A438AC530268f27ea041` | Treasury Safe — receives dev funds (immutable) |
| `presaleStartTimestamp` | `PRESALE_START` (computed) | Stream start anchor |

**Behavior:** Receives 15% of presale USDC (up to 1.05M). Streams over 180 days from presale start. `DEV_OPERATOR_ROLE` holder calls `withdraw()` to release streamed amount to immutable beneficiary.

#### 6c. TeamStreamVault

```
forge create src/presale/TeamStreamVault.sol:TeamStreamVault \
  --constructor-args $DEPLOYER $USDC $TEAM_BENEFICIARY $PRESALE_START $TEAM_STREAM_DURATION
```

| Parameter | Value | Purpose |
|---|---|---|
| `admin` | `0x7F13972C13ab207921Db2D6688283CC65923FdeA` | Initial `DEFAULT_ADMIN_ROLE` holder |
| `usdc` | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | USDC token address (immutable) |
| `beneficiary` | `0xfC93939aa7a0c744e3e5A438AC530268f27ea041` | Treasury Safe — receives team funds (immutable) |
| `streamStartTimestamp` | `PRESALE_START` (computed) | Stream start anchor |
| `streamDuration` | `31536000` (365 days) | Total stream duration (immutable) |

**Behavior:** Receives 10% of presale USDC (up to 700K). Streams linearly over 365 days. `TEAM_OPERATOR_ROLE` holder calls `withdraw()` to release streamed amount.

#### 6d. MarketingVault

```
forge create src/presale/MarketingVault.sol:MarketingVault \
  --constructor-args $DEPLOYER $USDC $MARKETING_BENEFICIARY $MARKETING_WITHDRAW_DELAY
```

| Parameter | Value | Purpose |
|---|---|---|
| `admin` | `0x7F13972C13ab207921Db2D6688283CC65923FdeA` | Initial `DEFAULT_ADMIN_ROLE` holder |
| `usdc` | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | USDC token address (immutable) |
| `beneficiary` | `0xfC93939aa7a0c744e3e5A438AC530268f27ea041` | Treasury Safe — receives marketing funds (immutable) |
| `withdrawalDelay` | `172800` (2 days) | Timelock between queue and execute (immutable) |

**Behavior:** Receives 5% of presale USDC (up to 350K). Two-step withdrawal: `queueWithdrawal()` then `executeWithdrawal()` after 2-day delay. Allows cancellation during the delay window.

#### 6e. PresaleVault

```
forge create src/presale/PresaleVault.sol:PresaleVault \
  --constructor-args $DEPLOYER $USDC $LIQUIDITY_VAULT $DEV_VAULT $TEAM_VAULT $MARKETING_VAULT
```

| Parameter | Value | Purpose |
|---|---|---|
| `admin` | `0x7F13972C13ab207921Db2D6688283CC65923FdeA` | Initial `DEFAULT_ADMIN_ROLE` holder |
| `usdc` | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | USDC token address (immutable) |
| `liquidityVault` | Deployed in 6a | 70% routing target (immutable) |
| `devRunwayVault` | Deployed in 6b | 15% routing target (immutable) |
| `teamStreamVault` | Deployed in 6c | 10% routing target (immutable) |
| `marketingVault` | Deployed in 6d | 5% routing target (immutable) |

**Behavior:** Central USDC router. When presale calls `routeFunds()`, splits incoming USDC 70/15/10/5 across the four destination vaults. All vault references are immutable (set at construction).

**USDC Routing Split:**

```
PresaleVault receives 100% of presale USDC
  ├── 70% → LiquidityVault   → Treasury Safe (0xfC93...e041)
  ├── 15% → DevRunwayVault    → Treasury Safe (0xfC93...e041)  [180d stream]
  ├── 10% → TeamStreamVault   → Treasury Safe (0xfC93...e041)  [365d stream]
  └──  5% → MarketingVault    → Treasury Safe (0xfC93...e041)  [2d timelock]
```

#### 6f. ClaimModule

```
forge create src/presale/ClaimModule.sol:ClaimModule \
  --constructor-args $DEPLOYER $AIC_TOKEN $TGE
```

| Parameter | Value | Purpose |
|---|---|---|
| `admin` | `0x7F13972C13ab207921Db2D6688283CC65923FdeA` | Initial `DEFAULT_ADMIN_ROLE` holder |
| `token` | Deployed in step 5 | AIC token address (immutable) |
| `tge` | `PRESALE_END + 1 day` (computed) | Token Generation Event timestamp (immutable) |

**Behavior:** Holds 500M AIC tokens for presale buyer claims. Three-step vesting schedule:

| Step | Timing | Cumulative % | AIC Released |
|---|---|---|---|
| 1 | TGE | 30% | Up to 150M AIC |
| 2 | TGE + 3 months | 65% | Up to 325M AIC |
| 3 | TGE + 6 months | 100% | Up to 500M AIC |

Claims are enabled permissionlessly via `enableClaims()` when conditions are met.

#### 6g. WebAI3Presale

```
forge create src/WebAI3Presale.sol:WebAI3Presale \
  --constructor-args $DEPLOYER $USDC $PRESALE_VAULT $CLAIM_MODULE $PRESALE_START $PRESALE_END
```

| Parameter | Value | Purpose |
|---|---|---|
| `admin` | `0x7F13972C13ab207921Db2D6688283CC65923FdeA` | Initial `DEFAULT_ADMIN_ROLE` holder |
| `usdc` | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | Payment token (immutable) |
| `presaleVault` | Deployed in 6e | Fund routing target (immutable) |
| `claimModule` | Deployed in 6f | Token claim module (immutable) |
| `presaleStart` | `NOW + 300s` | Presale open timestamp (immutable) |
| `presaleEnd` | `presaleStart + 120 days` | Presale close timestamp (immutable) |

**Behavior:** Main presale contract. Accepts USDC, allocates AIC tokens, routes USDC to PresaleVault. 7-phase pricing with 7M USDC hard cap and 500M AIC token cap. Finalization is permissionless via `finalizePresale()`.

### Step 7 — Save Deployed Addresses

Writes all contract addresses and configuration to `deployed.mainnet.presale.env`:

```env
AIC_TOKEN=<address>
USDC=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
LIQUIDITY_VAULT=<address>
DEV_VAULT=<address>
TEAM_VAULT=<address>
MARKETING_VAULT=<address>
PRESALE_VAULT=<address>
CLAIM_MODULE=<address>
PRESALE=<address>
PRESALE_START=<timestamp>
PRESALE_END=<timestamp>
TGE=<timestamp>
TEAM_STREAM_DURATION=31536000
MARKETING_WITHDRAW_DELAY=172800
ADMIN_SAFE=0x880512aF8aE2Bd44108E6155632b11329C952D1F
PAUSE_SAFE=0xd2F4185057c0709F19CB74f2E35e954234E9cCeC
OPS_SAFE=0xBF948c29EeF3D72B960993217dF77f07EC147065
TREASURY_SAFE=0xfC93939aa7a0c744e3e5A438AC530268f27ea041
```

This file is the source of truth for all downstream integrations (webai3_web, webai3-landing, webai3-dashboard).

### Step 8 — Etherscan Source Verification

Submits source code for all 7 presale contracts to Etherscan using `forge verify-contract`. The AIC Token is verified inline during step 5 via `--verify` on `forge script`.

Each verification:
- Encodes constructor arguments via `cast abi-encode`
- Retries up to 5 times with 15-second delays
- Treats failure as non-fatal (warns but continues)
- Recognizes "already verified" as success

Waits 30 seconds before starting to allow Etherscan indexing.

**Verified contracts (8 total):**

| # | Contract | Source Path |
|---|---|---|
| 1 | WebAI3Token | `src/WebAI3Token.sol:WebAI3Token` |
| 2 | LiquidityVault | `src/presale/LiquidityVault.sol:LiquidityVault` |
| 3 | DevRunwayVault | `src/presale/DevRunwayVault.sol:DevRunwayVault` |
| 4 | TeamStreamVault | `src/presale/TeamStreamVault.sol:TeamStreamVault` |
| 5 | MarketingVault | `src/presale/MarketingVault.sol:MarketingVault` |
| 6 | PresaleVault | `src/presale/PresaleVault.sol:PresaleVault` |
| 7 | ClaimModule | `src/presale/ClaimModule.sol:ClaimModule` |
| 8 | WebAI3Presale | `src/WebAI3Presale.sol:WebAI3Presale` |

### Step 9 — Wire Contracts

Six `cast send` transactions that establish the contract dependency graph. Each call uses a one-time configuration function that reverts if called a second time.

| # | Transaction | Target | Function | Argument |
|---|---|---|---|---|
| 1 | `LiquidityVault.setPresaleVault` | LiquidityVault | `setPresaleVault(address)` | PresaleVault address |
| 2 | `DevRunwayVault.setPresaleVault` | DevRunwayVault | `setPresaleVault(address)` | PresaleVault address |
| 3 | `TeamStreamVault.setPresaleVault` | TeamStreamVault | `setPresaleVault(address)` | PresaleVault address |
| 4 | `MarketingVault.setPresaleVault` | MarketingVault | `setPresaleVault(address)` | PresaleVault address |
| 5 | `PresaleVault.setPresale` | PresaleVault | `setPresale(address)` | WebAI3Presale address |
| 6 | `ClaimModule.setPresale` | ClaimModule | `setPresale(address)` | WebAI3Presale address |

**One-time guard:** All `setPresaleVault()` and `setPresale()` functions have a built-in guard that reverts on second invocation. This prevents reconfiguration after initial wiring, even by admin.

**Post-wiring contract graph:**

```
                          WebAI3Presale
                         /             \
                        v               v
                  PresaleVault      ClaimModule
                 /    |    |    \        |
                v     v    v     v       v
         Liquidity  Dev  Team  Marketing  (holds 500M AIC)
          Vault    Vault Vault  Vault
            |        |     |      |
            v        v     v      v
        Treasury  Treasury Treasury Treasury
         Safe      Safe    Safe    Safe
    (0xfC93...e041)
```

### Step 10 — Grant Operational Roles

Five `grantRole` transactions from the deployer EOA (which still holds `DEFAULT_ADMIN_ROLE`):

| # | Contract | Role | Granted To | Address |
|---|---|---|---|---|
| 1 | WebAI3Presale | `PAUSER_ROLE` | Pause Safe | `0xd2F4185057c0709F19CB74f2E35e954234E9cCeC` |
| 2 | LiquidityVault | `LIQUIDITY_OPERATOR_ROLE` | Ops Safe | `0xBF948c29EeF3D72B960993217dF77f07EC147065` |
| 3 | DevRunwayVault | `DEV_OPERATOR_ROLE` | Ops Safe | `0xBF948c29EeF3D72B960993217dF77f07EC147065` |
| 4 | TeamStreamVault | `TEAM_OPERATOR_ROLE` | Ops Safe | `0xBF948c29EeF3D72B960993217dF77f07EC147065` |
| 5 | MarketingVault | `MARKETING_OPERATOR_ROLE` | Ops Safe | `0xBF948c29EeF3D72B960993217dF77f07EC147065` |

Role hashes are fetched dynamically from the deployed contracts via `cast call` (e.g., `PAUSER_ROLE()(bytes32)`).

### Step 11 — Fund ClaimModule with 500M AIC

**Transaction:** `AIC_TOKEN.transfer(CLAIM_MODULE, 500_000_000 * 10^18)`

Transfers exactly `500,000,000,000,000,000,000,000,000` base units (500M AIC) from the deployer to the ClaimModule contract.

**Pre-check:** Verifies deployer AIC balance >= 500M via `balanceOf()`.
**Post-check:** Verifies ClaimModule AIC balance == exactly 500M.

### Step 12 — Post-Deploy On-Chain Verification

Runs 16+ automated checks against live chain state. This step is the gate for step 13 — if any check fails, admin handoff is blocked.

**Wiring checks (6):**

| Check | Call | Expected |
|---|---|---|
| `LiquidityVault.presaleVault()` | `cast call` | PresaleVault address |
| `DevRunwayVault.presaleVault()` | `cast call` | PresaleVault address |
| `TeamStreamVault.presaleVault()` | `cast call` | PresaleVault address |
| `MarketingVault.presaleVault()` | `cast call` | PresaleVault address |
| `PresaleVault.presale()` | `cast call` | WebAI3Presale address |
| `ClaimModule.presale()` | `cast call` | WebAI3Presale address |

**State checks (4):**

| Check | Call | Expected |
|---|---|---|
| `liquidityProvisioned` | `PresaleVault.liquidityProvisioned()` | `false` |
| `claimsEnabled` | `ClaimModule.claimsEnabled()` | `false` |
| `HARD_CAP` | `WebAI3Presale.HARD_CAP()` | `7000000000000` (7M USDC) |
| `lifecycle` | `WebAI3Presale.lifecycle()` | `0` (Pending) |

**Role checks (5):**

| Check | Call | Expected |
|---|---|---|
| Presale: PAUSER → Pause Safe | `hasRole(PAUSER_ROLE, 0xd2F4...cCeC)` | `true` |
| LiquidityVault: LIQUIDITY_OP → Ops Safe | `hasRole(LIQ_OP_ROLE, 0xBF94...7065)` | `true` |
| DevRunwayVault: DEV_OP → Ops Safe | `hasRole(DEV_ROLE, 0xBF94...7065)` | `true` |
| TeamStreamVault: TEAM_OP → Ops Safe | `hasRole(TEAM_ROLE, 0xBF94...7065)` | `true` |
| MarketingVault: MARKETING_OP → Ops Safe | `hasRole(MARKETING_ROLE, 0xBF94...7065)` | `true` |

**Funding check (1):**

| Check | Call | Expected |
|---|---|---|
| ClaimModule AIC balance | `AIC_TOKEN.balanceOf(CLAIM_MODULE)` | `500000000000000000000000000` |

**Verification gate:** If `CHECKS_FAILED > 0`, the script dies with: `"Refusing admin handoff: N verification checks failed in step 12. Fix issues first."`

### Step 13 — Transfer Admin to Multisig (IRREVERSIBLE)

**CONFIRMATION GATE 2:** Operator must type `TRANSFER` to continue.

This is the most critical step. It executes 22 transactions in 4 sub-phases:

#### 13a. Grant DEFAULT_ADMIN_ROLE to Admin Safe (8 transactions)

For each of the 8 contracts:
```
cast send <contract> "grantRole(bytes32,address)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  0x880512aF8aE2Bd44108E6155632b11329C952D1F
```

| Contract | Admin Safe Gains |
|---|---|
| WebAI3Token | `DEFAULT_ADMIN_ROLE` |
| WebAI3Presale | `DEFAULT_ADMIN_ROLE` |
| PresaleVault | `DEFAULT_ADMIN_ROLE` |
| LiquidityVault | `DEFAULT_ADMIN_ROLE` |
| DevRunwayVault | `DEFAULT_ADMIN_ROLE` |
| TeamStreamVault | `DEFAULT_ADMIN_ROLE` |
| MarketingVault | `DEFAULT_ADMIN_ROLE` |
| ClaimModule | `DEFAULT_ADMIN_ROLE` |

#### 13b. Grant PAUSER_ROLE to Pause Safe (2 transactions)

```
WebAI3Token:   grantRole(PAUSER_ROLE, 0xd2F4185057c0709F19CB74f2E35e954234E9cCeC)
WebAI3Presale: grantRole(PAUSER_ROLE, 0xd2F4185057c0709F19CB74f2E35e954234E9cCeC)
```

#### 13c. Revoke PAUSER_ROLE from Deployer (2 transactions)

```
WebAI3Token:   revokeRole(PAUSER_ROLE, 0x7F13972C13ab207921Db2D6688283CC65923FdeA)
WebAI3Presale: revokeRole(PAUSER_ROLE, 0x7F13972C13ab207921Db2D6688283CC65923FdeA)
```

#### 13d. Deployer Renounces DEFAULT_ADMIN_ROLE (8 transactions)

For each of the 8 contracts:
```
cast send <contract> "renounceRole(bytes32,address)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  0x7F13972C13ab207921Db2D6688283CC65923FdeA
```

**THIS IS IRREVERSIBLE.** After this call, the deployer EOA `0x7F13972C13ab207921Db2D6688283CC65923FdeA` permanently loses all admin access. The only entity that can manage roles is the Admin Safe (`0x880512aF8aE2Bd44108E6155632b11329C952D1F`) which requires 4-of-6 signers.

#### 13e. Verify Handoff (20 checks)

For each of the 8 contracts, verifies:
- Admin Safe has `DEFAULT_ADMIN_ROLE` → `true`
- Deployer has `DEFAULT_ADMIN_ROLE` → `false`

For Token and Presale, additionally verifies:
- Pause Safe has `PAUSER_ROLE` → `true`
- Deployer has `PAUSER_ROLE` → `false`

### Step 14 — Deployment Summary

Prints a complete summary including:
- All 8 contract addresses
- Timestamps (PRESALE_START, PRESALE_END, TGE)
- Total ETH spent and gas price
- Multisig governance assignments
- Etherscan links for all contracts
- Verification pass/fail count

Outputs are also written to a timestamped log file: `deploy_mainnet_YYYYMMDD_HHMMSS.log`

---

## 4. Transaction Manifest

Complete ordered list of all 30 on-chain transactions:

| # | Step | Action | From | To | Function |
|---|---|---|---|---|---|
| 1 | 5 | Deploy AIC Token | Deployer | CREATE | `constructor(admin, allocations)` |
| 2 | 6a | Deploy LiquidityVault | Deployer | CREATE | `constructor(admin, usdc, recipient)` |
| 3 | 6b | Deploy DevRunwayVault | Deployer | CREATE | `constructor(admin, usdc, beneficiary, start)` |
| 4 | 6c | Deploy TeamStreamVault | Deployer | CREATE | `constructor(admin, usdc, beneficiary, start, duration)` |
| 5 | 6d | Deploy MarketingVault | Deployer | CREATE | `constructor(admin, usdc, beneficiary, delay)` |
| 6 | 6e | Deploy PresaleVault | Deployer | CREATE | `constructor(admin, usdc, liq, dev, team, mktg)` |
| 7 | 6f | Deploy ClaimModule | Deployer | CREATE | `constructor(admin, token, tge)` |
| 8 | 6g | Deploy WebAI3Presale | Deployer | CREATE | `constructor(admin, usdc, vault, claim, start, end)` |
| 9 | 9 | Wire LiquidityVault | Deployer | LiquidityVault | `setPresaleVault(PresaleVault)` |
| 10 | 9 | Wire DevRunwayVault | Deployer | DevRunwayVault | `setPresaleVault(PresaleVault)` |
| 11 | 9 | Wire TeamStreamVault | Deployer | TeamStreamVault | `setPresaleVault(PresaleVault)` |
| 12 | 9 | Wire MarketingVault | Deployer | MarketingVault | `setPresaleVault(PresaleVault)` |
| 13 | 9 | Wire PresaleVault | Deployer | PresaleVault | `setPresale(WebAI3Presale)` |
| 14 | 9 | Wire ClaimModule | Deployer | ClaimModule | `setPresale(WebAI3Presale)` |
| 15 | 10 | Grant PAUSER_ROLE | Deployer | WebAI3Presale | `grantRole(PAUSER_ROLE, PauseSafe)` |
| 16 | 10 | Grant LIQUIDITY_OP | Deployer | LiquidityVault | `grantRole(LIQ_OP_ROLE, OpsSafe)` |
| 17 | 10 | Grant DEV_OP | Deployer | DevRunwayVault | `grantRole(DEV_ROLE, OpsSafe)` |
| 18 | 10 | Grant TEAM_OP | Deployer | TeamStreamVault | `grantRole(TEAM_ROLE, OpsSafe)` |
| 19 | 10 | Grant MARKETING_OP | Deployer | MarketingVault | `grantRole(MARKETING_ROLE, OpsSafe)` |
| 20 | 11 | Fund ClaimModule | Deployer | AIC_TOKEN | `transfer(ClaimModule, 500M AIC)` |
| 21 | 13a | Grant admin (Token) | Deployer | WebAI3Token | `grantRole(ADMIN, AdminSafe)` |
| 22 | 13a | Grant admin (Presale) | Deployer | WebAI3Presale | `grantRole(ADMIN, AdminSafe)` |
| 23 | 13a | Grant admin (PresaleVault) | Deployer | PresaleVault | `grantRole(ADMIN, AdminSafe)` |
| 24 | 13a | Grant admin (LiquidityVault) | Deployer | LiquidityVault | `grantRole(ADMIN, AdminSafe)` |
| 25 | 13a | Grant admin (DevVault) | Deployer | DevRunwayVault | `grantRole(ADMIN, AdminSafe)` |
| 26 | 13a | Grant admin (TeamVault) | Deployer | TeamStreamVault | `grantRole(ADMIN, AdminSafe)` |
| 27 | 13a | Grant admin (MarketingVault) | Deployer | MarketingVault | `grantRole(ADMIN, AdminSafe)` |
| 28 | 13a | Grant admin (ClaimModule) | Deployer | ClaimModule | `grantRole(ADMIN, AdminSafe)` |
| 29 | 13b | Grant PAUSER (Token) | Deployer | WebAI3Token | `grantRole(PAUSER, PauseSafe)` |
| 30 | 13b | Grant PAUSER (Presale) | Deployer | WebAI3Presale | `grantRole(PAUSER, PauseSafe)` |
| 31 | 13c | Revoke PAUSER (Token) | Deployer | WebAI3Token | `revokeRole(PAUSER, Deployer)` |
| 32 | 13c | Revoke PAUSER (Presale) | Deployer | WebAI3Presale | `revokeRole(PAUSER, Deployer)` |
| 33-40 | 13d | Renounce admin (x8) | Deployer | All 8 contracts | `renounceRole(ADMIN, Deployer)` |

**Total: 40 transactions** (8 deploys + 6 wiring + 5 role grants + 1 transfer + 10 grant admin/pauser + 2 revoke pauser + 8 renounce admin)

---

## 5. Role Assignment Matrix

### Post-Deploy, Pre-Handoff (Steps 5-12)

| Contract | DEFAULT_ADMIN_ROLE | PAUSER_ROLE | Operator Role |
|---|---|---|---|
| WebAI3Token | Deployer EOA | Deployer EOA | — |
| WebAI3Presale | Deployer EOA | Deployer EOA + Pause Safe | — |
| PresaleVault | Deployer EOA | — | — |
| LiquidityVault | Deployer EOA | — | Ops Safe (LIQUIDITY_OP) |
| DevRunwayVault | Deployer EOA | — | Ops Safe (DEV_OP) |
| TeamStreamVault | Deployer EOA | — | Ops Safe (TEAM_OP) |
| MarketingVault | Deployer EOA | — | Ops Safe (MARKETING_OP) |
| ClaimModule | Deployer EOA | — | — |

### Post-Handoff (After Step 13) — Final State

| Contract | DEFAULT_ADMIN_ROLE | PAUSER_ROLE | Operator Role |
|---|---|---|---|
| WebAI3Token | Admin Safe (`0x8805...D1F`) | Pause Safe (`0xd2F4...cCeC`) | — |
| WebAI3Presale | Admin Safe (`0x8805...D1F`) | Pause Safe (`0xd2F4...cCeC`) | — |
| PresaleVault | Admin Safe (`0x8805...D1F`) | — | — |
| LiquidityVault | Admin Safe (`0x8805...D1F`) | — | Ops Safe (`0xBF94...7065`) |
| DevRunwayVault | Admin Safe (`0x8805...D1F`) | — | Ops Safe (`0xBF94...7065`) |
| TeamStreamVault | Admin Safe (`0x8805...D1F`) | — | Ops Safe (`0xBF94...7065`) |
| MarketingVault | Admin Safe (`0x8805...D1F`) | — | Ops Safe (`0xBF94...7065`) |
| ClaimModule | Admin Safe (`0x8805...D1F`) | — | — |

**Deployer EOA (`0x7F13...FdeA`):** Zero roles on all contracts. Permanently locked out.

---

## 6. Constructor Arguments Reference

Encoded constructor arguments for Etherscan verification:

| Contract | ABI Types | Arguments |
|---|---|---|
| WebAI3Token | `(address, (address,uint256)[])` | admin, 6 allocations summing to 10^27 |
| LiquidityVault | `(address, address, address)` | admin, USDC, LIQUIDITY_RECIPIENT |
| DevRunwayVault | `(address, address, address, uint64)` | admin, USDC, DEV_BENEFICIARY, PRESALE_START |
| TeamStreamVault | `(address, address, address, uint64, uint256)` | admin, USDC, TEAM_BENEFICIARY, PRESALE_START, 31536000 |
| MarketingVault | `(address, address, address, uint256)` | admin, USDC, MARKETING_BENEFICIARY, 172800 |
| PresaleVault | `(address, address, address, address, address, address)` | admin, USDC, LiqVault, DevVault, TeamVault, MktgVault |
| ClaimModule | `(address, address, uint64)` | admin, AIC_TOKEN, TGE |
| WebAI3Presale | `(address, address, address, address, uint64, uint64)` | admin, USDC, PresaleVault, ClaimModule, PRESALE_START, PRESALE_END |

---

## 7. Verification Checklist

Total automated checks: **51** (16 in step 12 + 35 in step 13e, counted cumulatively)

### Step 12 Checks (16)

- [ ] 6 wiring checks (each vault's `presaleVault()` / `presale()` matches expected address)
- [ ] `liquidityProvisioned == false`
- [ ] `claimsEnabled == false`
- [ ] `HARD_CAP == 7,000,000,000,000` (7M USDC in 6-decimal)
- [ ] `lifecycle == 0` (Pending)
- [ ] 5 role checks (`hasRole` for each operator → assigned Safe)
- [ ] ClaimModule AIC balance == 500,000,000 * 10^18

### Step 13e Checks (20)

- [ ] 8 checks: Admin Safe has `DEFAULT_ADMIN_ROLE` on each contract
- [ ] 8 checks: Deployer lost `DEFAULT_ADMIN_ROLE` on each contract
- [ ] 2 checks: Pause Safe has `PAUSER_ROLE` on Token + Presale
- [ ] 2 checks: Deployer lost `PAUSER_ROLE` on Token + Presale

---

## 8. Irreversibility Map

| Action | Reversible? | Notes |
|---|---|---|
| Contract deployment | No | Contracts are permanent on-chain |
| `setPresaleVault()` | No | One-time guard prevents reconfiguration |
| `setPresale()` | No | One-time guard prevents reconfiguration |
| `grantRole()` to Safes | Yes | Admin can revoke (before renounce) |
| `revokeRole(PAUSER)` from deployer | Yes | Admin Safe can re-grant |
| **`renounceRole(DEFAULT_ADMIN_ROLE)` from deployer** | **No** | **Permanent — deployer loses all admin access forever** |
| Beneficiary addresses | No | Immutable in constructor — cannot be changed |
| Vault routing percentages | No | Immutable in PresaleVault constructor |
| `HARD_CAP` | No | Constant in WebAI3Presale |
| `TGE` timestamp | No | Immutable in ClaimModule constructor |

**Point of no return:** Step 13d (renounceRole). Everything before this step can be partially recovered by the deployer. After 13d, only the Admin Safe (4-of-6 multisig) has administrative control.

---

## 9. Gas Budget

Based on battle test results (Anvil, 1.77 gwei gas price):

| Category | Transactions | Estimated Gas | Estimated Cost |
|---|---|---|---|
| AIC Token deploy | 1 | ~3,574,000 | ~0.0063 ETH |
| Presale contract deploys | 7 | ~8,000,000 | ~0.0142 ETH |
| Wiring (setPresaleVault/setPresale) | 6 | ~300,000 | ~0.0005 ETH |
| Role grants | 5 | ~250,000 | ~0.0004 ETH |
| Token transfer | 1 | ~65,000 | ~0.0001 ETH |
| Admin handoff (grant + revoke + renounce) | 20 | ~1,000,000 | ~0.0018 ETH |
| **Total** | **40** | **~13,200,000** | **~0.004 ETH** |

**Recommended deployer balance:** 0.05 ETH minimum (provides ~10x buffer for mainnet gas fluctuations). The script enforces this minimum in step 3.

**Note:** Actual mainnet costs depend on gas price at deployment time. At 30 gwei (moderate congestion), total cost would be approximately 0.4 ETH.

---

## 10. Recovery Procedures

### Scenario: Step fails mid-deploy (before step 13)

The deployer EOA still holds `DEFAULT_ADMIN_ROLE` on all deployed contracts. Options:
1. Fix the issue and re-run the script with `SKIP_TOKEN=1` and manually set already-deployed contract addresses
2. Abandon and redeploy everything from scratch (deployed contracts become orphans)

### Scenario: Step 12 verification fails

The script blocks step 13 automatically. Investigate the failing check, fix the issue (e.g., re-run a wiring transaction that was missed), then re-run with `VERIFY_ONLY=1` to confirm fixes.

### Scenario: Step 13 partially completes

If the script crashes mid-handoff (e.g., after granting admin to Admin Safe on some contracts but before renouncing on all):
- The deployer EOA still has admin on un-renounced contracts
- The Admin Safe also has admin on already-granted contracts
- **Action:** Complete the remaining transactions manually via `cast send`

### Scenario: Post-handoff operational issue

After step 13 completes, the deployer EOA has zero roles. All admin actions require the Admin Safe (4-of-6):
- Role rotation: `grantRole` / `revokeRole` via Admin Safe
- Emergency pause: Pause Safe (2-of-3) calls `pause()` on Token or Presale
- Stuck pause: Anyone can call `forceUnpause()` after 72 hours
- Operator disappears: Permissionless fallbacks exist for liquidity provisioning, presale finalization, and claim enabling

---

## Appendix: File Outputs

| File | Purpose |
|---|---|
| `deployed.mainnet.presale.env` | All contract addresses + timestamps + Safe addresses |
| `deploy_mainnet_YYYYMMDD_HHMMSS.log` | Full terminal output with timestamps |
| `broadcast/DeployWebAI3Token.s.sol/1/run-latest.json` | Foundry broadcast data for token deploy |

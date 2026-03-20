---
title: Contract Deployment
description: Step-by-step guide to deploying the WebAI3 contract suite — deployment order, one-time wiring, role grants, and post-deploy verification.
section: Developer Reference
order: 8
---

The contract suite consists of 8 contracts that must be deployed in order. Dependencies flow downward: vaults are deployed before the presale, the presale is deployed before the claim module is funded.

---

## Prerequisites

- [Foundry](https://getfoundry.sh) installed (`forge`, `cast`, `anvil`)
- Deployer wallet with enough ETH for gas
- All environment variables set (see below)
- RPC endpoint for the target network

---

## Required Environment Variables

```bash
# Deployer
export DEPLOYER_PRIVATE_KEY=0x...
export RPC_URL=https://sepolia.infura.io/v3/...

# Admin (receives DEFAULT_ADMIN_ROLE and PAUSER_ROLE on token)
export TOKEN_ADMIN=0xYourMultisigAddress

# Operators (role-based access for vault operations)
export LIQUIDITY_OPERATOR=0x...   # calls provideLiquidity()
export DEV_OPERATOR=0x...         # calls DevRunwayVault.withdraw()
export TEAM_OPERATOR=0x...        # calls TeamStreamVault.withdraw()
export MARKETING_OPERATOR=0x...   # calls MarketingVault.queueWithdrawal()

# Beneficiaries (where vault funds are sent)
export LIQUIDITY_RECIPIENT=0x...  # receives liquidity vault USDC for DEX provisioning
export DEV_BENEFICIARY=0x...      # receives dev runway USDC
export TEAM_BENEFICIARY=0x...     # receives team stream USDC
export MARKETING_BENEFICIARY=0x...# receives marketing USDC

# Token allocation recipients (must sum to 1B AIC)
export PRESALE_CLAIM_MODULE=0x...  # set after deploying ClaimModule
export ECOSYSTEM_ADDRESS=0x...
export TREASURY_ADDRESS=0x...
export TEAM_TOKEN_ADDRESS=0x...
export LIQUIDITY_INFRA_ADDRESS=0x...

# Presale configuration
export PRESALE_START=$(date -d "+1 day" +%s)   # unix timestamp
export PRESALE_END=$(date -d "+120 days" +%s)  # unix timestamp
export TGE_TIMESTAMP=$(date -d "+150 days" +%s) # unix timestamp

# USDC address
export USDC=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238  # Sepolia
# export USDC=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48  # Mainnet
```

---

## Deployment Order

### Step 1: Deploy Sub-Vaults

Deploy all four vaults first. They have no dependency on each other.

```bash
# LiquidityVault
LIQUIDITY_VAULT=$(forge create \
  src/presale/LiquidityVault.sol:LiquidityVault \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args $TOKEN_ADMIN $USDC $LIQUIDITY_RECIPIENT \
  --json | jq -r '.deployedTo')

# DevRunwayVault
DEV_VAULT=$(forge create \
  src/presale/DevRunwayVault.sol:DevRunwayVault \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args $TOKEN_ADMIN $USDC $DEV_BENEFICIARY $PRESALE_START \
  --json | jq -r '.deployedTo')

# TeamStreamVault (365-day stream from PRESALE_START)
TEAM_VAULT=$(forge create \
  src/presale/TeamStreamVault.sol:TeamStreamVault \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args $TOKEN_ADMIN $USDC $TEAM_BENEFICIARY $PRESALE_START 31536000 \
  --json | jq -r '.deployedTo')

# MarketingVault (2-day withdrawal timelock)
MARKETING_VAULT=$(forge create \
  src/presale/MarketingVault.sol:MarketingVault \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args $TOKEN_ADMIN $USDC $MARKETING_BENEFICIARY 172800 \
  --json | jq -r '.deployedTo')

echo "Vaults deployed:"
echo "  LiquidityVault:  $LIQUIDITY_VAULT"
echo "  DevRunwayVault:  $DEV_VAULT"
echo "  TeamStreamVault: $TEAM_VAULT"
echo "  MarketingVault:  $MARKETING_VAULT"
```

### Step 2: Deploy PresaleVault

```bash
PRESALE_VAULT=$(forge create \
  src/presale/PresaleVault.sol:PresaleVault \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args \
    $TOKEN_ADMIN \
    $USDC \
    $LIQUIDITY_VAULT \
    $DEV_VAULT \
    $TEAM_VAULT \
    $MARKETING_VAULT \
  --json | jq -r '.deployedTo')

echo "PresaleVault: $PRESALE_VAULT"
```

### Step 3: Deploy ClaimModule

ClaimModule needs the TGE timestamp at deployment.

```bash
CLAIM_MODULE=$(forge create \
  src/presale/ClaimModule.sol:ClaimModule \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args $TOKEN_ADMIN $AIC_TOKEN $TGE_TIMESTAMP \
  --json | jq -r '.deployedTo')

echo "ClaimModule: $CLAIM_MODULE"
```

> **Note:** `$AIC_TOKEN` must be known before deploying ClaimModule. Either deploy the token first (Step 4 variant), or deploy ClaimModule with a placeholder and set the presale after both are deployed.

### Step 4: Deploy WebAI3Token

The token constructor takes an `Allocation[]` array. Allocations must sum to exactly 1,000,000,000 AIC.

| Recipient | Amount |
|---|---:|
| ClaimModule | 500,000,000 AIC |
| Ecosystem address | 150,000,000 AIC |
| Treasury address | 150,000,000 AIC |
| Team token address | 100,000,000 AIC |
| Liquidity/infra address | 100,000,000 AIC |

Using cast or a deployment script:

```bash
AIC_TOKEN=$(forge script \
  script/DeployToken.s.sol:DeployToken \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --json | jq -r '.deployments[0].address')

echo "WebAI3Token (AIC): $AIC_TOKEN"
```

### Step 5: Deploy WebAI3Presale

```bash
PRESALE=$(forge create \
  src/WebAI3Presale.sol:WebAI3Presale \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args \
    $TOKEN_ADMIN \
    $USDC \
    $PRESALE_VAULT \
    $CLAIM_MODULE \
    $PRESALE_START \
    $PRESALE_END \
  --json | jq -r '.deployedTo')

echo "WebAI3Presale: $PRESALE"
```

---

## One-Time Wiring

After deployment, each vault and the claim module must be wired to their upstream callers. These are one-time operations — calling them again reverts with `AlreadyConfigured()`.

```bash
# Wire PresaleVault → sub-vaults
cast send $LIQUIDITY_VAULT "setPresaleVault(address)" $PRESALE_VAULT \
  --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY

cast send $DEV_VAULT "setPresaleVault(address)" $PRESALE_VAULT \
  --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY

cast send $TEAM_VAULT "setPresaleVault(address)" $PRESALE_VAULT \
  --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY

cast send $MARKETING_VAULT "setPresaleVault(address)" $PRESALE_VAULT \
  --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY

# Wire PresaleVault → WebAI3Presale
cast send $PRESALE_VAULT "setPresale(address)" $PRESALE \
  --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY

# Wire ClaimModule → WebAI3Presale
cast send $CLAIM_MODULE "setPresale(address)" $PRESALE \
  --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY
```

---

## Grant Operational Roles

```bash
LIQUIDITY_OPERATOR_ROLE=$(cast keccak "LIQUIDITY_OPERATOR_ROLE")
DEV_OPERATOR_ROLE=$(cast keccak "DEV_OPERATOR_ROLE")
TEAM_OPERATOR_ROLE=$(cast keccak "TEAM_OPERATOR_ROLE")
MARKETING_OPERATOR_ROLE=$(cast keccak "MARKETING_OPERATOR_ROLE")
PAUSER_ROLE=$(cast keccak "PAUSER_ROLE")

cast send $LIQUIDITY_VAULT "grantRole(bytes32,address)" \
  $LIQUIDITY_OPERATOR_ROLE $LIQUIDITY_OPERATOR \
  --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY

cast send $DEV_VAULT "grantRole(bytes32,address)" \
  $DEV_OPERATOR_ROLE $DEV_OPERATOR \
  --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY

cast send $TEAM_VAULT "grantRole(bytes32,address)" \
  $TEAM_OPERATOR_ROLE $TEAM_OPERATOR \
  --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY

cast send $MARKETING_VAULT "grantRole(bytes32,address)" \
  $MARKETING_OPERATOR_ROLE $MARKETING_OPERATOR \
  --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY

cast send $PRESALE "grantRole(bytes32,address)" \
  $PAUSER_ROLE $TOKEN_ADMIN \
  --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY
```

---

## Post-Deploy Verification

Verify the system is wired correctly before the presale starts:

```bash
# Token total supply
cast call $AIC_TOKEN "totalSupply()(uint256)" --rpc-url $RPC_URL
# Expected: 1000000000000000000000000000 (1B × 1e18)

# ClaimModule holds 500M AIC
cast call $AIC_TOKEN "balanceOf(address)(uint256)" $CLAIM_MODULE --rpc-url $RPC_URL
# Expected: 500000000000000000000000000

# PresaleVault is wired to sub-vaults
cast call $PRESALE_VAULT "liquidityVault()(address)" --rpc-url $RPC_URL
# Expected: $LIQUIDITY_VAULT

# Presale knows its vault
cast call $PRESALE "presaleVault()(address)" --rpc-url $RPC_URL
# Expected: $PRESALE_VAULT

# ClaimModule knows the presale
cast call $CLAIM_MODULE "presale()(address)" --rpc-url $RPC_URL
# Expected: $PRESALE

# Presale lifecycle
cast call $PRESALE "lifecycle()(uint8)" --rpc-url $RPC_URL
# Expected: 0 (Pending) before start, 1 (Active) after start
```

### Etherscan Verification

```bash
forge verify-contract $AIC_TOKEN \
  src/WebAI3Token.sol:WebAI3Token \
  --chain sepolia \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address,(address,uint256)[])" \
    $TOKEN_ADMIN [...allocations])
```

Repeat for each contract.

---

## Deployment Checklist

- [ ] All environment variables set and double-checked
- [ ] Token admin address is a Gnosis Safe (M-of-N multisig)
- [ ] All 5 allocation recipients verified (no typos, not zero address)
- [ ] Allocation sum verified to equal exactly 1,000,000,000 AIC
- [ ] All 4 vault addresses verified in PresaleVault constructor
- [ ] All `setPresaleVault()` calls completed and verified
- [ ] `setPresale()` on PresaleVault and ClaimModule completed
- [ ] All operator roles granted to correct addresses
- [ ] ClaimModule has 500M AIC balance
- [ ] `lifecycle()` returns `Pending` before presale start
- [ ] All contracts verified on Etherscan
- [ ] Contract addresses recorded and propagated to landing page and inference app

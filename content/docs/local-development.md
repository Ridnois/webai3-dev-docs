---
title: Local Development
description: How to run the full WebAI3 stack locally — Anvil (Ethereum fork), the inference app, and the full x402 payment flow without real USDC.
section: Developer Reference
order: 7
---

The inference app runs locally against an Anvil fork of Sepolia. Payments are mocked (no real USDC settlement), but inference calls Replicate for real.

---

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **Foundry** (for Anvil) — install via `curl -L https://foundry.paradigm.xyz | bash`
- **PostgreSQL** running locally or a DATABASE_URL connection string
- A **Replicate API token** (for actual model inference)
- A **Cloudflare R2** bucket (or use any S3-compatible storage)

---

## 1. Install Dependencies

```bash
cd webai3_web
pnpm install
```

---

## 2. Configure Environment

Copy the example env file and fill in the required values:

```bash
cp .env.example .env.local
```

Minimum required variables:

```bash
# Server
REPLICATE_API_TOKEN=r8_...
DATABASE_URL=postgresql://localhost:5432/webai3_dev
SESSION_SECRET=any-32-character-or-longer-string-here
RECEIVER_ADDRESS=0xYourWalletAddress

# R2 storage
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=webai3-dev
R2_PUBLIC_URL=https://pub-xxx.r2.dev

# Client — enable Anvil dev chain
NEXT_PUBLIC_ENABLE_DEV_CHAIN=true
```

---

## 3. Set Up the Database

```bash
pnpm db:push   # pushes Drizzle schema to your PostgreSQL instance
```

If you don't have PostgreSQL locally:

```bash
# Start a local PostgreSQL via Docker
docker run -d --name webai3-pg \
  -e POSTGRES_DB=webai3_dev \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 postgres:16
```

Then set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/webai3_dev`.

---

## 4. Start Anvil (Local Ethereum Fork)

Anvil forks Sepolia so the local chain has real USDC balances. Start it in a separate terminal:

```bash
pnpm chain:start
```

This runs `anvil --fork-url $SEPOLIA_RPC_URL --chain-id 31337`. The local chain runs at `http://127.0.0.1:8545`.

---

## 5. Fund a Test Wallet

Anvil gives you 10 pre-funded test accounts with 10,000 ETH each. Account #0's private key is always the same:

```
Private key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
Address:     0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

Import this into MetaMask using the private key, then add the Anvil network:

```
Network name: Anvil Local
RPC URL: http://127.0.0.1:8545
Chain ID: 31337
Currency symbol: ETH
```

Fund the account with test USDC:

```bash
pnpm chain:fund
```

This script mints test USDC to account #0 on the local chain.

---

## 6. Start the App

```bash
pnpm dev
```

The app runs at `http://localhost:3000`. Content layer watches for markdown changes; Next.js watches for code changes.

---

## 7. Test the Full Payment Flow

1. Open `http://localhost:3000` in your browser
2. Connect MetaMask with the Anvil network selected
3. Sign in with the test wallet
4. Choose a task and model
5. Enter a prompt
6. Click **Run**

On the local dev chain (`chainId == 31337`), the payment flow skips the real x402 facilitator:
- `verifyWithFacilitator` → skipped
- `settleWithFacilitator` → skipped (a UUID is returned as the fake tx hash)
- Inference runs normally against Replicate

You still need to sign the EIP-712 payment authorization in MetaMask — the signing step is real, only the settlement is mocked.

---

## 8. Running Tests

```bash
pnpm test         # run all tests once
pnpm test:watch   # watch mode
pnpm test:ui      # Vitest UI
```

Tests use Vitest + Testing Library. They do not require a running database or Anvil.

---

## Common Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Start Next.js + contentlayer in watch mode |
| `pnpm build` | Production build |
| `pnpm chain:start` | Start Anvil fork of Sepolia |
| `pnpm chain:fund` | Mint test USDC to account #0 |
| `pnpm db:push` | Push Drizzle schema to database |
| `pnpm db:studio` | Open Drizzle Studio (local DB GUI) |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run test suite |

---

## Contract Development (webai3_token)

For working on smart contracts:

```bash
cd webai3_token

# Install Foundry dependencies
forge install

# Run tests
forge test -vvv

# Run with gas report
forge test --gas-report

# Run invariant tests
forge test --match-contract Invariants -vvv

# Deploy to Anvil
anvil &
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

---

## Troubleshooting

**Port 8545 already in use**

```bash
lsof -i :8545  # find the process
kill -9 <PID>  # kill it
```

**MetaMask nonce mismatch after restarting Anvil**

Anvil resets state on restart. MetaMask caches the nonce. Fix: go to MetaMask → Settings → Advanced → Clear activity and nonce data.

**USDC balance not visible in MetaMask**

Add the USDC token manually: import token → paste the Sepolia USDC address (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`).

**`DATABASE_URL` connection refused**

Make sure PostgreSQL is running and the connection string matches. Test with:

```bash
psql $DATABASE_URL -c "SELECT 1"
```

**Replicate model returns error**

Some Replicate models require a cold start of 30–90 seconds. The first request may time out. Try again or switch to a model with more usage (higher run count = warmer instances).

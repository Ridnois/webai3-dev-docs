---
title: Self-Hosted x402 Facilitator
description: How to deploy webai3-facilitator and wire it into webai3_web — replacing the third-party facilitator with our own Ethereum mainnet settlement service.
section: Developer Reference
order: 8
---

The `webai3-facilitator` project is a self-hosted x402 payment facilitator for **Ethereum mainnet** (`eip155:1`). It replaces the third-party `facilitator.x402.fi` endpoint and gives us full control over payment verification and on-chain USDC settlement.

Repository: [github.com/Ridnois/webai3-facilitator](https://github.com/Ridnois/webai3-facilitator) (private)

---

## Why we need our own facilitator

The x402 protocol requires a **facilitator** — a trusted service that:

1. **Verifies** a client's EIP-3009 payment signature without touching the chain
2. **Settles** the payment on-chain by calling `USDC.transferWithAuthorization()`

The public facilitators (`facilitator.x402.fi`, Coinbase CDP) only support **Base** mainnet. Our inference app targets **Ethereum mainnet** — so we run our own.

---

## Architecture

```
User wallet                webai3_web                  webai3-facilitator
    │                           │                              │
    │──── sign EIP-3009 ───────►│                              │
    │                           │── POST /verify ─────────────►│
    │                           │◄── { isValid: true } ────────│
    │                           │── POST /settle ─────────────►│
    │                           │                    ┌─────────┴──────────┐
    │                           │                    │ USDC contract      │
    │                           │                    │ .transferWithAuth()│
    │                           │                    └─────────┬──────────┘
    │                           │◄── { success, txHash } ──────│
    │                           │
    │◄── inference result ──────│
```

The facilitator is **stateless** — no database. Every request is a self-contained verify or settle operation.

---

## Facilitator setup

### 1. Clone and install

```bash
git clone git@github.com:Ridnois/webai3-facilitator.git
cd webai3-facilitator
pnpm install
```

### 2. Create the hot wallet

The facilitator needs a dedicated Ethereum wallet to pay gas for each settlement transaction. This is **not** the receiver wallet — it only needs ETH, not USDC.

```bash
# Generate a new wallet with cast (Foundry)
cast wallet new

# Output:
# Successfully created new keypair.
# Address:     0xAbCd...
# Private key: 0x1234...
```

Fund this address with ETH on Ethereum mainnet. A typical settlement costs ~60,000 gas. At 10 gwei that is ~0.0006 ETH per settlement. Keep at least 0.05 ETH in the wallet as a buffer.

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# Required — the hot wallet that pays gas for settlements
EVM_PRIVATE_KEY=0x<your-hot-wallet-private-key>

# Required in production — use a dedicated RPC, not the public default
EVM_RPC_URL=https://mainnet.infura.io/v3/<your-key>
# or: https://eth-mainnet.g.alchemy.com/v2/<your-key>
# or: https://rpc.quicknode.pro/<your-key>

# Optional
PORT=4022
ALLOWED_ORIGINS=https://app.webai3.app
```

> **Never commit `.env.local`.** It contains the hot wallet private key.

### 4. Run locally

```bash
pnpm dev
```

Expected output:

```
🚀 webai3-facilitator
   Network : Ethereum mainnet (eip155:1)
   Signer  : 0xAbCd...
   RPC     : https://mainnet.infura.io/v3/...
   Port    : 4022
```

Verify it's working:

```bash
curl http://localhost:4022/health
# {"status":"ok","signer":"0xAbCd...","network":"eip155:1"}

curl http://localhost:4022/supported
# {"kinds":[{"x402Version":2,"scheme":"exact","network":"eip155:1"}],"extensions":[],"signers":{...}}
```

---

## Wiring into webai3_web

The inference app reads the facilitator URL from a single environment variable.

### Development

In `webai3_web/.env.local`, add or update:

```bash
X402_FACILITATOR_URL=http://localhost:4022
```

This overrides the default (`https://facilitator.x402.fi`). Run both services in parallel:

```bash
# Terminal 1
cd webai3-facilitator && pnpm dev

# Terminal 2
cd webai3_web && pnpm dev
```

### Production

Set `X402_FACILITATOR_URL` in your hosting platform's environment variables:

```bash
X402_FACILITATOR_URL=https://facilitator.webai3.app
```

The facilitator must be reachable from the `webai3_web` server (not the browser). It is a **server-to-server** call only — it never exposes the private key to clients.

---

## Where webai3_web calls the facilitator

The two call sites in `webai3_web/src/lib/x402.ts`:

```typescript
// Verify — called before showing the payment dialog
export async function verifyWithFacilitator(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirement
): Promise<VerifyResponse> {
  const env = getServerEnv();
  const res = await fetchWithTimeout(`${env.X402_FACILITATOR_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x402Version: 2, paymentPayload, paymentRequirements }),
    timeoutMs: 15_000,
  });
  // ...
}

// Settle — called after user signs the payment
export async function settleWithFacilitator(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirement
): Promise<SettlementResponse> {
  const env = getServerEnv();
  const res = await fetchWithTimeout(`${env.X402_FACILITATOR_URL}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x402Version: 2, paymentPayload, paymentRequirements }),
    timeoutMs: 30_000,
  });
  // ...
}
```

Both functions read `X402_FACILITATOR_URL` from server env — validated in `src/lib/server-env.ts`:

```typescript
X402_FACILITATOR_URL: z
  .string()
  .url()
  .optional()
  .default("https://facilitator.x402.fi"),
```

---

## How a full payment flows end to end

```
1. User submits prompt on inference page
   └── webai3_web client: POST /api/inference (no Payment-Signature header)

2. webai3_web server: returns 402
   └── Header: Payment-Required: <base64 PaymentRequiredResponse>
       Body:   { estimatedCostUsdc, estimatedSeconds, ratePerSec }

3. webai3_web client: shows PaymentConfirmDialog
   └── User clicks "Confirm" → wallet popup → signs EIP-712 transferWithAuthorization

4. webai3_web client: POST /api/inference (with Payment-Signature header)

5. webai3_web server: decodes payload, calls facilitator
   a. POST http://facilitator:4022/verify
      └── facilitator: recovers signer from EIP-712 signature
                       checks USDC balance ≥ amount
                       validates time window
      └── returns: { isValid: true, payer: "0x..." }

   b. POST http://facilitator:4022/settle
      └── facilitator hot wallet: calls USDC.transferWithAuthorization(
              from=user, to=RECEIVER_ADDRESS, value=amount,
              validAfter, validBefore, nonce, v, r, s
          )
      └── waits for on-chain confirmation
      └── returns: { success: true, transaction: "0x...", payer: "0x..." }

6. webai3_web server: settlement confirmed → calls Replicate API → returns result
   └── Inference record written to DB with payment_tx_hash
```

---

## Deployment

The facilitator is a standard Node.js HTTP server. No database. No file system state.

### Railway (recommended)

1. Connect the GitHub repo in Railway dashboard
2. Set environment variables: `EVM_PRIVATE_KEY`, `EVM_RPC_URL`, `ALLOWED_ORIGINS`
3. Set `PORT=8080` (Railway's default expected port) or use Railway's auto-detected port
4. Deploy — Railway auto-detects Node.js and runs `pnpm start` after `pnpm build`

Add a custom domain (e.g. `facilitator.webai3.app`) in Railway's networking settings.

### Fly.io

```bash
cd webai3-facilitator
fly launch --name webai3-facilitator --no-deploy
fly secrets set EVM_PRIVATE_KEY=0x... EVM_RPC_URL=https://...
fly deploy
```

Add to `fly.toml`:

```toml
[[services]]
  internal_port = 4022
  protocol = "tcp"
  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

### VPS (Ubuntu/Debian)

```bash
# Install Node 20 and pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm pm2

# Clone and build
git clone git@github.com:Ridnois/webai3-facilitator.git /opt/webai3-facilitator
cd /opt/webai3-facilitator
pnpm install
pnpm build

# Start with pm2
PORT=4022 EVM_PRIVATE_KEY=0x... EVM_RPC_URL=https://... pm2 start dist/index.js --name facilitator
pm2 save && pm2 startup
```

Reverse-proxy with Caddy:

```
facilitator.webai3.app {
    reverse_proxy localhost:4022
}
```

---

## Monitoring the hot wallet

The facilitator hot wallet is an operational dependency. If it runs out of ETH, settlements fail and users cannot run inference.

**Recommended:** Set up a balance alert using any of:
- [Tenderly](https://tenderly.co) — alerts when wallet balance drops below threshold
- [Chainlink Automation](https://automation.chain.link) — auto-top-up trigger
- A simple cron script:

```bash
#!/bin/bash
# check-balance.sh — run every 30 minutes via cron
BALANCE=$(cast balance 0xYourHotWallet --rpc-url https://eth.llamarpc.com)
THRESHOLD=20000000000000000  # 0.02 ETH in wei

if [ "$BALANCE" -lt "$THRESHOLD" ]; then
  echo "⚠️  Hot wallet balance below 0.02 ETH: $BALANCE wei" | mail -s "Facilitator alert" ops@webai3.app
fi
```

Add to crontab: `*/30 * * * * /opt/scripts/check-balance.sh`

---

## Security notes

| Risk | Mitigation |
|---|---|
| `EVM_PRIVATE_KEY` leak | Never log it, never commit it, use platform secrets manager |
| Facilitator DDoS | Rate-limit at reverse proxy (Cloudflare, nginx) — not in app code |
| Replay attacks | The x402 SDK validates `validBefore` timestamp; expired signatures are rejected |
| Settlement front-running | `transferWithAuthorization` nonce is random per payment; can't be replayed |
| RPC outage | Use a paid RPC with SLA; consider a fallback RPC in `EVM_RPC_URL` if using a provider that supports comma-separated fallbacks |

---

## Testing the integration

### Smoke test with curl

```bash
# Start facilitator locally
cd webai3-facilitator && pnpm dev

# Confirm /supported returns eip155:1
curl -s http://localhost:4022/supported | jq '.kinds'
# [{"x402Version":2,"scheme":"exact","network":"eip155:1","extra":null}]

# A valid /verify call requires a real signed payload from a wallet.
# The easiest way to test end-to-end is to run webai3_web locally with
# X402_FACILITATOR_URL=http://localhost:4022 and submit an inference job.
```

### Full local integration test

```bash
# 1. Start the facilitator
cd webai3-facilitator
EVM_PRIVATE_KEY=0x<dev-key> EVM_RPC_URL=https://... pnpm dev

# 2. Start webai3_web pointing at local facilitator
cd webai3_web
X402_FACILITATOR_URL=http://localhost:4022 pnpm dev

# 3. Open http://localhost:3000 → connect wallet → run an inference job
#    Watch the facilitator logs for:
#    [verify] ✅ valid payer=0x...
#    [settle] ✅ tx=0x... payer=0x...
```

---

## Environment variable reference

### webai3-facilitator

| Variable | Required | Default | Description |
|---|---|---|---|
| `EVM_PRIVATE_KEY` | **Yes** | — | Hot wallet private key (`0x`-prefixed hex) |
| `EVM_RPC_URL` | No | `https://eth.llamarpc.com` | Ethereum mainnet RPC endpoint |
| `PORT` | No | `4022` | HTTP listen port |
| `ALLOWED_ORIGINS` | No | `*` | CORS allowed origins (comma-separated or `*`) |

### webai3_web

| Variable | Required | Default | Description |
|---|---|---|---|
| `X402_FACILITATOR_URL` | No | `https://facilitator.x402.fi` | Facilitator base URL (no trailing slash) |
| `RECEIVER_ADDRESS` | **Yes** | — | Ethereum address that receives USDC on settlement |

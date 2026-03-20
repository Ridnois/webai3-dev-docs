---
title: System Architecture
description: Full technical overview of the WebAI3 system — all components, how they connect, and the data flows between them.
section: Developer Reference
order: 1
---

WebAI3 is four independent projects that integrate through on-chain state and URLs. No build-time dependencies exist between them.

---

## Projects

| Project | Path | Purpose | Stack |
|---|---|---|---|
| `webai3_web` | `/webai3_web` | Inference API + app | Next.js 16, PostgreSQL, Replicate, Cloudflare R2 |
| `webai3-landing` | `/webai3-landing` | Marketing + presale UI | Next.js 16, wagmi v2, viem |
| `webai3-token` | `/webai3-token` | Smart contracts | Solidity 0.8.24, Foundry, OpenZeppelin v5 |
| `webai3-dashboard` | `/webai3-dashboard` | Admin monitoring | Next.js 16, wagmi v2, read-only on-chain |

---

## Smart Contract System

Eight contracts form the on-chain system:

```
WebAI3Token (ERC-20 governance token)
    └── deployed with 6 genesis allocations

WebAI3Presale (7-phase USDC sale)
    ├── reads: USDC balance, active phase
    ├── writes: PresaleVault.routeDeposit()
    └── writes: ClaimModule.recordAllocation()

PresaleVault (fund router)
    ├── 70% → LiquidityVault
    ├── 15% → DevRunwayVault
    ├── 10% → TeamStreamVault
    └──  5% → MarketingVault

ClaimModule (vesting + claims)
    └── holds 500M AIC, releases to buyers per vesting schedule
```

### Contract Addresses (Sepolia testnet)

> Mainnet addresses pending deployment after audit.

| Contract | Address |
|---|---|
| WebAI3Token | TBD |
| WebAI3Presale | TBD |
| PresaleVault | TBD |
| LiquidityVault | TBD |
| DevRunwayVault | TBD |
| TeamStreamVault | TBD |
| MarketingVault | TBD |
| ClaimModule | TBD |

---

## Integration Map

```
┌─────────────────────────────────────────────────────┐
│                  Ethereum Blockchain                 │
│                                                      │
│  USDC (ERC-20)          AIC (WebAI3Token)           │
│  WebAI3Presale          ClaimModule                  │
│  PresaleVault           4 Sub-Vaults                 │
└──────────┬──────────────────────┬────────────────────┘
           │                      │
           │ on-chain reads       │ on-chain reads
           ▼                      ▼
  ┌─────────────────┐   ┌─────────────────┐
  │  webai3-landing │   │  webai3_web      │
  │                 │   │                  │
  │  Phase display  │   │  Inference API   │
  │  Presale UI     │   │  USDC payments   │
  │  Buy flow       │   │  AIC discounts   │
  └─────────────────┘   └────────┬─────────┘
                                 │
                         ┌───────┼──────────┐
                         ▼       ▼          ▼
                    Replicate   R2       PostgreSQL
                    (models)  (media)   (inference log)
```

### Integration Points

| From | To | Mechanism |
|---|---|---|
| `webai3-landing` | `WebAI3Presale` | viem public client, RPC read |
| `webai3-landing` | `WebAI3Token` | viem public client, phase/balance reads |
| `webai3_web` | x402 Facilitator | HTTPS — verify + settle |
| `webai3_web` | Replicate | HTTPS API — model prediction |
| `webai3_web` | Cloudflare R2 | S3 API — media upload |
| `webai3_web` | PostgreSQL | TCP — inference records |
| `webai3_web` | `IAICStaking` *(planned)* | viem — read staked balance |
| `webai3-dashboard` | All contracts | viem — read-only monitoring |

---

## Inference Payment Flow

The full payment cycle for a single inference request:

```
Client                    webai3_web API             x402 Facilitator
  │                            │                           │
  │── POST /api/inference ────▶│                           │
  │   (no Payment header)      │                           │
  │                            │── calculate cost ─────────│
  │◀─ 402 Payment Required ────│                           │
  │   (Payment-Required header)│                           │
  │                            │                           │
  │── signTypedData() ─────────│ (wallet-side, EIP-712)    │
  │   (EIP-3009 authorization) │                           │
  │                            │                           │
  │── POST /api/inference ────▶│                           │
  │   (Payment-Signature hdr)  │── verifyWithFacilitator ─▶│
  │                            │◀─ ok ─────────────────────│
  │                            │── settleWithFacilitator ──▶│
  │                            │◀─ txHash ─────────────────│
  │                            │                           │
  │                            │── Replicate.predictions.create()
  │                            │── upload media to R2
  │                            │── persist to PostgreSQL
  │◀─ 200 inference result ────│
```

---

## Authentication Flow

WebAI3 uses SIWE (Sign-In With Ethereum, EIP-4361) for authentication:

```
1. GET /api/auth/nonce      → server generates nonce, stores in session
2. wallet.signMessage(SIWE message with nonce)
3. POST /api/auth/verify    → server verifies signature, upserts user, saves address in session
4. Session cookie set (iron-session, HTTP-only, 24h TTL)
5. All subsequent requests read address from session cookie
```

---

## Database Schema

```sql
-- Users table: one row per Ethereum address
users (
  address       TEXT PRIMARY KEY,   -- checksummed 0x... address
  created_at    TIMESTAMPTZ,
  last_seen_at  TIMESTAMPTZ
)

-- Inferences table: one row per inference run
inferences (
  id                UUID PRIMARY KEY,
  user_address      TEXT REFERENCES users(address),
  task_type         TEXT,           -- 'text-to-image' | 'text-to-text' | 'text-to-sound'
  model             TEXT,           -- 'owner/model-name'
  input             JSONB,          -- prompt and other inputs
  output_type       TEXT,           -- 'text' | 'image' | 'audio'
  output_data       JSONB,          -- text output or null
  r2_keys           JSONB,          -- string[] of R2 object keys for media
  status            TEXT,           -- 'pending' | 'succeeded' | 'failed'
  error_message     TEXT,
  predict_time_ms   INTEGER,
  estimated_cost_usdc NUMERIC(18,6),
  actual_cost_usdc    NUMERIC(18,6),
  payment_tx_hash   TEXT UNIQUE,    -- on-chain settlement tx hash
  payment_chain_id  INTEGER,
  is_public         INTEGER,        -- 0 or 1 (boolean)
  created_at        TIMESTAMPTZ
)
```

---

## Environment Variables

### webai3_web (server)

| Variable | Required | Description |
|---|---|---|
| `REPLICATE_API_TOKEN` | Yes | Replicate API key |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | iron-session encryption key (≥32 chars) |
| `RECEIVER_ADDRESS` | Yes | Ethereum address that receives USDC payments |
| `R2_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Yes | R2 access key |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 secret key |
| `R2_BUCKET_NAME` | Yes | R2 bucket name |
| `R2_PUBLIC_URL` | Yes | Public base URL for R2 bucket |
| `INFERENCE_RATE_PER_SEC` | No | USDC/second rate (default: 0.001) |
| `X402_FACILITATOR_URL` | No | Override facilitator URL |
| `ADMIN_ADDRESSES` | No | Comma-separated admin wallet addresses |

### webai3_web (client)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_ETHEREUM_RPC_URL` | No | Ethereum mainnet RPC URL |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | No | Sepolia RPC URL |
| `NEXT_PUBLIC_ENABLE_DEV_CHAIN` | No | Enable Anvil local chain |

---

## Key Libraries

| Library | Version | Purpose |
|---|---|---|
| Next.js | 16 | App framework (App Router) |
| wagmi | v2 | Ethereum wallet integration |
| viem | — | Ethereum client (reads, signing) |
| Drizzle ORM | — | Type-safe PostgreSQL queries |
| iron-session | — | Encrypted HTTP-only session cookies |
| replicate | — | Replicate API client |
| zod | — | Schema validation |
| @aws-sdk/client-s3 | — | Cloudflare R2 (S3-compatible) |

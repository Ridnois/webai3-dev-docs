---
title: Pre-Release Checklist
description: Every action required before WebAI3 goes live on Ethereum mainnet, organized by priority.
section: Operations
order: 1
---

## Current State (Mar 2026)

| Project | Status | Deployed |
|---|---|---|
| `webai3_token` | Contracts deployed + verified on Sepolia | Sepolia testnet ✓ |
| `webai3-dashboard` | Fully functional, monitoring Sepolia | Sepolia testnet ✓ |
| `webai3_web` | Functional on Sepolia, missing infra hardening | Sepolia testnet (partial) |
| `webai3-landing` | Functional, placeholder addresses + legal templates | Not deployed |

---

## Critical Path — Launch Blockers

Nothing ships without these.

---

### 1. Smart Contract Hardening

**Security**

- [ ] Commission a third-party smart contract audit covering all 8 contracts — focus on vesting math, streaming formulas, and phase boundary transitions
- [ ] Bump fuzz runs from 1000 to 5000 for vesting and streaming math

**Token Distribution**

All 1B AIC tokens currently sit in the single admin wallet (`0xB40A959...`). Distribute before mainnet:

- [ ] Community allocation (350M) → community/ecosystem multisig
- [ ] Team allocation (200M) → team vesting contract or multisig
- [ ] Investors allocation (150M) → investor wallets
- [ ] Treasury allocation (150M) → treasury multisig
- [ ] Incentives allocation (100M) → incentives wallet
- [ ] Liquidity allocation (50M) → liquidity provisioning wallet
- [ ] Move admin role from deployer EOA to a Gnosis Safe multisig
- [ ] Move all operator roles (LIQUIDITY_OPERATOR_ROLE, DEV_OPERATOR_ROLE, TEAM_OPERATOR_ROLE, MARKETING_OPERATOR_ROLE) to separate operational wallets

**Mainnet Deployment**

- [ ] Run full end-to-end test on Sepolia: finalize → provide liquidity → enable claims → claim → vault withdrawals
- [ ] Prepare mainnet deployment parameters (multisig addresses, real timestamps, hard cap, phase definitions)
- [ ] Deploy all 8 contracts to Ethereum mainnet via `forge script`
- [ ] Verify all 8 contracts on Etherscan
- [ ] Propagate mainnet addresses to `webai3-landing/.env.production`, `webai3-dashboard/.env.production`, `webai3_web/src/lib/contracts.ts`

---

### 2. Inference App — Infrastructure Gaps

**Health & Observability**

- [ ] Add `/api/health` endpoint — checks DB, R2, Replicate. Returns `{ status, db, r2, replicate, timestamp }`. Required for load balancer health checks
- [ ] Replace all `console.log` / `console.error` with structured logging (pino). ~16 console calls across API routes — production logs need to be machine-parseable
- [ ] Integrate Sentry for runtime error tracking. Payment failures and inference errors need alerting, not just logs
- [ ] Set up uptime monitoring on `/api/health`

**Containerization**

- [ ] Write `Dockerfile` for `webai3_web`:
  - Node.js 20 slim base
  - `pnpm install --frozen-lockfile`
  - `pnpm build`
  - Non-root user
  - Expose port 3000
  - Healthcheck on `/api/health`
- [ ] Write `docker-compose.yml` for local dev with PostgreSQL + app
- [ ] Validate `pnpm db:migrate` runs on container startup before traffic is accepted

**Rate Limiting**

- [ ] Wire up the existing rate limiter (`src/lib/rate-limit.ts` exists but is not called). Apply to:
  - `POST /api/inference` — 10/min per wallet
  - `POST /api/auth/verify` — 20/min per IP
  - `GET /api/models` — 60/min per IP

**Security**

- [ ] Add explicit CSRF token validation for all state-changing endpoints
- [ ] Add `Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security` headers to `next.config.ts`
- [ ] Restrict R2 CORS to production domain only
- [ ] Run `pnpm audit` and resolve all HIGH/CRITICAL findings
- [ ] Put Cloudflare WAF in front of the app
- [ ] Commission external penetration test (SIWE auth, x402 payment bypass, unauthorized inference)

---

### 3. Landing Site — Production Readiness

**Contract Integration**

- [ ] Replace all placeholder addresses in `.env.production`:
  - `NEXT_PUBLIC_PRESALE_TOKEN_ADDRESS` → mainnet AIC token
  - `NEXT_PUBLIC_PRESALE_CONTRACT_ADDRESS` → mainnet presale
  - `NEXT_PUBLIC_CLAIM_MODULE_ADDRESS` → mainnet claim module
  - `NEXT_PUBLIC_USDC_ADDRESS` → `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- [ ] Set `NEXT_PUBLIC_PRESALE_CURRENT_PHASE_ID` as a fallback (primary source is now on-chain — see below)
- [ ] Set `NEXT_PUBLIC_PRESALE_CONTRACT_ADDRESS` to the mainnet `WebAI3Presale` address (enables on-chain phase reads)
- [ ] Set `NEXT_PUBLIC_CHAIN_ID=1` for mainnet
- [ ] Set `NEXT_PUBLIC_RPC_URL` to a production RPC endpoint (Alchemy, Infura, etc.) — do not rely on public nodes under load

**Presale UX**

- [ ] Review and sign off on `/terms` and `/risk` legal pages with legal counsel — currently templates
- [ ] Add live presale progress bar reading directly from `WebAI3Presale.totalRaisedUSDC`
- [ ] Add phase countdown timer (based on `PRESALE_END_TIMESTAMP` from the contract)
- [ ] Consider native wagmi-based checkout instead of external redirect — improves conversion

**Analytics**

- [ ] Add Plausible or PostHog for privacy-respecting analytics (pageviews, CTA clicks, UTM tracking)

---

### 4. AIC Token Integration in the Inference App

- [ ] Read buyer's AIC balance on-chain in the wallet UI
- [ ] Define and implement staking discount tiers (see [AIC Integration](/docs/app/aic-integration))
- [ ] Apply discount in `POST /api/inference` before pricing
- [ ] Display AIC balance in the wallet dropdown alongside USDC
- [ ] Add "Your AIC Benefits" panel on the dashboard

---

## High Priority — Before Marketing Push

---

### 5. CI/CD Pipelines

No GitHub Actions exist in any repo. Every PR should be gated.

**webai3-token**

- [ ] `forge build` + `forge test` + `forge fmt --check` on every PR
- [ ] Gas snapshot on PRs, comment diff
- [ ] Slither or Aderyn static analysis on every PR
- [ ] Deployment workflow gated behind manual approval (never auto-deploy contracts)

**webai3_web**

- [ ] `pnpm lint` + `pnpm test` + `pnpm build` on every PR
- [ ] `pnpm audit --audit-level=high` — fail PR on HIGH/CRITICAL vulnerabilities
- [ ] Deploy preview on every PR
- [ ] Auto-deploy `main` → `pnpm db:migrate` → production

**webai3-landing**

- [ ] `pnpm build` on every PR
- [ ] Deploy preview on every PR
- [ ] Auto-deploy `main` to production

---

### 6. Operational Readiness

**Database**

- [ ] Automated daily backups with point-in-time recovery enabled
- [ ] Test restore procedure — document recovery time objective
- [ ] `pnpm db:migrate` integrated into deployment pipeline

**Secrets Management**

- [ ] Move from `.env` files to a secrets manager: AWS SSM, Doppler, or 1Password Secrets Automation
- [ ] Document key rotation procedure for `SESSION_SECRET`, `REPLICATE_API_TOKEN`, R2 keys (zero-downtime)

**Incident Response**

Write a runbook covering:
- [ ] Replicate API outage: queue jobs, notify users, retry on recovery
- [ ] Database outage: read-only mode, clear error messaging
- [ ] Payment settlement failure: investigation steps, stuck tx hash procedure
- [ ] Smart contract pause activation: who gets alerted, what the 72h window means operationally
- [ ] Post-presale operator checklist (see [Post-Presale Operations](/docs/token/post-presale-operations))

---

### 7. Community & Social

- [ ] Discord server with: `#general`, `#presale-support`, `#inference-help`, `#bug-reports`, `#announcements`
- [ ] Telegram group for quick updates and presale questions
- [ ] X (Twitter) presence — milestones, inference examples, AIC utility
- [ ] 3 demo videos: presale buy, inference run, AIC vesting
- [ ] KOL relationships established before launch week (testnet access early)

---

## Launch Day Checklist

In order. Do not skip steps.

```
PRE-LAUNCH (48h before)
──────────────────────────────────────────────────────
[ ] Full end-to-end smoke test on Sepolia:
    wallet connect → buy presale → inference payment → claim tokens
[ ] All mainnet contract addresses propagated to all repos
[ ] Legal pages reviewed by counsel and published
[ ] Discord and Telegram communities live and moderated
[ ] Runbook reviewed by all operators
[ ] All operator wallets funded with ETH for gas (mainnet)
[ ] Admin transferred to multisig — deployer EOA no longer admin
[ ] Confirm: NEXT_PUBLIC_ENABLE_DEV_CHAIN = false
[ ] Confirm: X402_FACILITATOR_URL points to production facilitator
[ ] Rate limits configured and tested
[ ] Health endpoint responding correctly

LAUNCH (T=0)
──────────────────────────────────────────────────────
[ ] DNS cutover: webai3.xyz (landing) + app.webai3.xyz (inference)
[ ] Smoke test live URLs: landing page, inference app, presale flow
[ ] Monitor: error rates (Sentry), health endpoint, DB connections
[ ] Announce on X, Telegram, Discord simultaneously
[ ] First team member on-call (4h minimum watch)

POST-LAUNCH (first 24h)
──────────────────────────────────────────────────────
[ ] Check presale purchase events on-chain (dashboard)
[ ] Verify USDC routing to all vaults (dashboard)
[ ] Confirm inference payments settling on-chain
[ ] Respond to community questions in Discord/Telegram
[ ] Monitor for unusual patterns: large single buys, error spikes
```

---

## Environment Variables — Mainnet Production

### webai3_web

| Variable | Required | Notes |
|---|---|---|
| `REPLICATE_API_TOKEN` | Yes | Production token |
| `DATABASE_URL` | Yes | Production PostgreSQL |
| `SESSION_SECRET` | Yes | 32+ random chars, rotatable |
| `R2_ACCOUNT_ID` | Yes | Production R2 account |
| `R2_ACCESS_KEY_ID` | Yes | Production R2 key |
| `R2_SECRET_ACCESS_KEY` | Yes | Production R2 secret |
| `R2_BUCKET_NAME` | Yes | Production bucket |
| `R2_PUBLIC_URL` | Yes | CDN-backed public URL |
| `RECEIVER_ADDRESS` | Yes | Mainnet wallet receiving USDC |
| `X402_FACILITATOR_URL` | Yes | `https://facilitator.x402.fi` |
| `INFERENCE_RATE_PER_SEC` | No | Default `0.001` |
| `NEXT_PUBLIC_ENABLE_DEV_CHAIN` | — | Must be `false` |

### webai3-landing

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_PRESALE_TOKEN_ADDRESS` | Yes | Mainnet AIC token |
| `NEXT_PUBLIC_PRESALE_CONTRACT_ADDRESS` | Yes | Mainnet presale — also enables on-chain phase reads |
| `NEXT_PUBLIC_CLAIM_MODULE_ADDRESS` | Yes | Mainnet claim module |
| `NEXT_PUBLIC_USDC_ADDRESS` | Yes | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| `NEXT_PUBLIC_PRESALE_CURRENT_PHASE_ID` | No | Fallback phase ID if on-chain read fails. Set to `phase-1` at launch |
| `NEXT_PUBLIC_CHAIN_ID` | No | Default `1`. Set explicitly to `1` for mainnet |
| `NEXT_PUBLIC_RPC_URL` | Yes (production) | Alchemy/Infura endpoint — do not rely on public nodes under load |
| `NEXT_PUBLIC_NETWORK_NAME` | Yes | `Ethereum Mainnet` |
| `NEXT_PUBLIC_EXPLORER_BASE_URL` | Yes | `https://etherscan.io` |

### webai3-dashboard

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_PRESALE_ADDRESS` | Yes | Mainnet presale |
| `NEXT_PUBLIC_PRESALE_VAULT_ADDRESS` | Yes | Mainnet presale vault |
| `NEXT_PUBLIC_LIQUIDITY_VAULT_ADDRESS` | Yes | Mainnet liquidity vault |
| `NEXT_PUBLIC_DEV_VAULT_ADDRESS` | Yes | Mainnet dev vault |
| `NEXT_PUBLIC_TEAM_VAULT_ADDRESS` | Yes | Mainnet team vault |
| `NEXT_PUBLIC_MARKETING_VAULT_ADDRESS` | Yes | Mainnet marketing vault |
| `NEXT_PUBLIC_CLAIM_MODULE_ADDRESS` | Yes | Mainnet claim module |
| `NEXT_PUBLIC_AIC_TOKEN_ADDRESS` | Yes | Mainnet AIC token |
| `NEXT_PUBLIC_USDC_ADDRESS` | Yes | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |

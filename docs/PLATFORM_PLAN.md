# Spova Clone — Platform Plan

Last updated: 2026-10-05  
Audience: client + engineering + Cursor agent  
Status: approved direction (not yet scaffolded)

This file is the source of truth for **what we are building**, **how**, and **in what order**.  
The PDF is a printable copy of this document. The Cursor rule `.cursor/rules/spova-platform.mdc` tells the agent to follow it.

---

## 1. What the client asked for (4 products)

| # | Product | User-facing meaning |
|---|---------|---------------------|
| 1 | Marketing site | Public pages like spova.com (Home, Markets, Accounts, Platform, Legal, FAQ) |
| 2 | Client portal | Login, KYC/docs, demo/live accounts, deposit, withdraw, history, statements, help |
| 3 | Trading terminal | Live charts, buy/sell, positions, margin, P/L |
| 4 | Admin back office | Approve KYC, see each client, credit/debit, freeze trading, change leverage/margins |

We build **all four**. We do **not** build them in parallel from day one.

---

## 2. What Spova actually is (research, 2026-10-05)

Explored `https://spova.com` and logged into client area as `deactivate@gmail.com` (Rankaj Kumar). **No admin access.**

Spova is **not** a custom stack. It is:

- **WordPress** marketing site (multilingual)
- **Fintech360** client CRM SPA at `/client-area`
- **MatchTrader** live terminal at `platform.spova.com` (Cloudflare-blocked in headless)
- **Cashier** at `deposit.cashier.fintech360.tech` (Finosoft cards + Praxis APM)
- Admin = vendor BO (Fintech360 + Match-Trader Manager) — not on this login

Client-area rail: Deposit, Trading accounts, Payments, Documents, Statement, InvestiQ, Help, Profile.

This account:

- Live Classic MatchTrade, leverage 1:100, **balance $0**
- Demo login 746181, ~$16.15M balance, trading simulated, no withdraw
- KYC POI pending, POR incomplete
- Deposits **blocked by cashier BO**
- Payment history: many declined $250 (and one $10,000) in May 2026
- Margin call 100% / stop-out 20% on marketing tables; FX leverage up to 1:400

**We do not buy Fintech360/MatchTrader unless the client pays for those licences.** We clone the **product shape**, with our own code.

---

## 3. Non-negotiable architecture

One API. One Postgres. Four UIs (or one Next app with four route groups). Same users, same money.

```
Cloudflare CDN
    ├── apps/web        marketing (SEO)
    ├── apps/client     CRM portal
    ├── apps/trader     charts + orders   (can live at /trade in same Next app)
    └── apps/admin      back office
            │
         Nginx/Caddy
            │
         NestJS API  (REST + WebSocket)
            ├── PostgreSQL 16
            ├── Redis 7
            ├── BullMQ workers (stop-out, mail, PDFs)
            └── R2/S3 (KYC files)
            └── Price worker (Binance / Finnhub / Twelve Data)
```

Day-1 trading model: **CFD on our books**. We stream prices, client opens a position, **we are the counterparty**. Admin controls balance. No licensed FX matching engine in v1.

---

## 4. Locked stack

Do not bikeshed this unless the client is already locked to PHP/Laravel.

| Layer | Choice |
|-------|--------|
| Repo | pnpm + Turborepo |
| Marketing / Client / Admin / Trade UI | Next.js 15 App Router + Tailwind + shadcn |
| Charts | TradingView Lightweight Charts |
| API | NestJS + Prisma |
| DB | PostgreSQL 16 — money as `NUMERIC(18,2)` |
| Cache / pubsub / sessions | Redis 7 |
| Jobs | BullMQ |
| Files | Cloudflare R2 (or S3) |
| Auth | JWT httpOnly cookies, access ~15m, refresh ~7d |
| Realtime | Nest WebSocket / Socket.IO rooms `user:{id}`, `admin`, `symbol:EURUSD` |
| Payments v1 | Admin credit/debit + deposit/withdraw **request queue** |
| Payments v2 | One PSP adapter (Stripe / crypto / UPI) later |
| Email | Resend or SMTP |
| Infra v1 | One 8GB VPS + Docker Compose + Cloudflare |
| Backups | Nightly `pg_dump` to R2 |

**Forbidden for core ledger:** MongoDB, Firebase as source of truth, updating `balance` without a ledger row, storing KYC on local disk/git.

---

## 5. Routes (target)

```
/                          marketing
/forex /commodities …      market pages
/login /register           auth
/app                       client CRM (Spova-style left rail)
  /app/accounts
  /app/payments/deposit
  /app/payments/withdraw
  /app/payments/history
  /app/documents
  /app/statement
  /app/help
  /app/profile
/trade                     trader workspace
/admin                     role-guarded
  /admin/clients
  /admin/kyc
  /admin/wallet
  /admin/trades
  /admin/payments
  /admin/settings
```

---

## 6. NestJS modules

1. Auth — register, login, refresh, forgot password, roles  
2. Users / Profile  
3. Kyc — POI / POR / payment / other  
4. Accounts — demo + live, leverage, status, trading_blocked  
5. Ledger — **only place money moves**  
6. Payments — deposit/withdraw requests, later gateway adapters  
7. Market — symbols, contract specs, sessions  
8. Trading — market/limit, positions, SL/TP  
9. Risk — used margin, free margin, call 100%, stop-out 20% (config per tier)  
10. Admin — freeze, credit/debit with reason, force-close, change leverage  
11. Support — tickets  
12. Statements — PDF  
13. Realtime — ticks + position updates  

---

## 7. ERD (core tables)

```
USER 1--* TRADING_ACCOUNT
USER 1--* KYC_DOCUMENT
USER 1--* TICKET
USER 1--1 USER_PROFILE
USER 1--* SESSION

TRADING_ACCOUNT 1--* LEDGER_ENTRY
TRADING_ACCOUNT 1--* ORDER
TRADING_ACCOUNT 1--* POSITION
TRADING_ACCOUNT 1--* PAYMENT_REQUEST

SYMBOL 1--* ORDER
SYMBOL 1--* POSITION
SYMBOL 1--* CANDLE

ORDER 0..1-- POSITION
ADMIN_AUDIT *-- USER
```

### USER
- id (uuid PK)
- email (unique)
- password_hash
- role: `client | admin | superadmin`
- status: `active | frozen | closed`
- kyc_poi, kyc_por (bool)
- created_at

### USER_PROFILE
- user_id PK/FK
- first_name, last_name, phone, country, city, address, zip, dob

### TRADING_ACCOUNT
- id, user_id
- type: `demo | live`
- login_code
- tier: `classic | silver | gold | platinum | vip`
- currency (USD default)
- leverage (int)
- balance, credit (NUMERIC)
- status: `enabled | disabled | readonly`
- trading_blocked (bool)

Equity is **not stored** as source of truth; it is `balance + floating_pnl + credit`.

### LEDGER_ENTRY
- account_id, type (`deposit|withdraw|credit|debit|pnl|swap|fee|adjustment`)
- amount, balance_after, reason, admin_id, ref_id, created_at

### PAYMENT_REQUEST
- account_id, kind `deposit|withdraw`, amount, status `pending|approved|declined`, method, admin_note

### KYC_DOCUMENT
- user_id, group `poi|por|payment|other`, doc_type, file_key, status `pending|approved|rejected`, reject_reason

### SYMBOL
- id (`EURUSD`), asset_class, digits, contract_size, min_lot, max_lot, leverage_max, tick_size, is_open

### ORDER / POSITION
- side buy|sell, lots, prices, sl, tp, status, margin_used, profit

Also: `password_reset`, `notification_prefs`, `admin_audit`, `statement_export`, `symbol_session`.

**Candles:** Redis last price; optional `candles(symbol, timeframe, time, ohlc)` filled by worker. Not every tick forever in v1.

### Margin formulas (Spova-like, admin-configurable)

```
equity       = balance + floating_pnl + credit
used_margin  = sum(lots * contract_size * price / leverage)
free_margin  = equity - used_margin
margin_level = equity / used_margin * 100
```

Default: margin call **100%**, stop-out **20%**.

---

## 8. Build order (do not skip)

### Phase 0 — skeleton (~1 week)
Monorepo, Nest health, Postgres, Redis, Docker, login/register, role guards, empty `/app` `/admin` `/trade` shells, homepage.

### Phase 1 — money + admin (the real product)
Demo/live accounts, ledger, admin list clients, **credit/debit**, freeze user, disable trading, change leverage. Client sees balance. **First milestone that matters.**

### Phase 2 — KYC + payment queue
R2 uploads, admin approve/reject. Deposit/withdraw as **requests**, history list.

### Phase 3 — trader
Symbols, WS prices (crypto + a few FX from a cheap feed), candles, market buy/sell, positions, SL/TP, live P/L, stop-out worker. Demo first.

### Phase 4 — marketing pages
Forex, commodities, tiers, legal, FAQ. Easy; do **after** portal works.

### Phase 5 — live money + one gateway
Same rules as demo on live accounts. One payment adapter. InvestiQ-style extras last.

---

## 9. Infra v1

- Single VPS ~8 GB RAM
- Docker Compose: `api`, `worker`, `web`, `postgres`, `redis`
- Cloudflare proxy
- R2 bucket `kyc`
- Nightly backup
- Split boxes only when WS/charts actually hurt

---

## 10. Time (honest)

- One strong full-stack: **3–5 months** for a convincing demo of all four
- Real-money production (audit, risk, 99.9% WS, licensed PSP): **6–12+ months**
- Pixel-perfect Spova + real FX liquidity is a **broker company**, not a website job

---

## 11. Agent / implementation rules

When coding this repo:

1. Read this file before inventing a new stack or table.
2. Never move money except via `LEDGER_ENTRY` in a DB transaction with the account row lock.
3. Demo and live share code; they differ by `trading_account.type` and whether withdrawals are allowed.
4. Admin actions write `admin_audit`.
5. Do not integrate Praxis/Finosoft/MatchTrader unless the client buys them.
6. Do not start Kubernetes, Go matching engine, or AI InvestiQ before Phase 1 works.
7. Do not commit `.env`, JWTs, or KYC files.
8. First scaffold target: Turborepo + Nest + Prisma schema from this ERD + Next layouts + login + admin credit on demo.

---

## 12. First command when the client says “start”

Scaffold Phase 0–1 only:

- Prisma models from section 7
- Auth + roles
- Admin credit/debit
- Client dashboard showing demo balance

Stop there until that is demoable.

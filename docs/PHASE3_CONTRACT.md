# Phase 3 contract: worker <-> API <-> web

Source: `docs/ARCHITECTURE.pdf` §05, §07, §08, §10. This file pins the exact names so the three processes agree.
Pure math (margin, P/L, triggers, swap, bucketing) lives in `packages/shared/src/risk.ts` and is used by all three.

## Processes
- **worker** (`apps/worker`, one instance): price ingest, candles, risk loop, pending-order triggers, swap cron. Never touches money directly.
- **api** (`apps/api`): the only process that writes orders/positions/ledger. Exposes `/v1/internal/trading/*` for the worker.
- **web**: reads REST, subscribes to WS.

## Redis
| Key / channel | Writer | Shape |
|---|---|---|
| `price:{SYMBOL}` hash | worker | `{bid, ask, ts}` — **our** price (feed ± spread_markup/2), `ts` ms epoch. Stale if `now - ts > 10_000` (`QUOTE_MAX_AGE_MS`). |
| `candle:live:{SYMBOL}:{tf}` hash | worker | `{t,o,h,l,c,v}` current bar (t = bucket start, unix **seconds**) |
| `acct:{accountId}` hash | worker | last snapshot `{balance,credit,equity,usedMargin,freeMargin,marginLevel,ts}` (api falls back to DB math when missing) |
| `pos:{positionId}` hash | worker | `{floatingUsd, currentPrice, ts}` |
| `worker:heartbeat` | worker | ms epoch, EX 30 |
| `feed:{source}:status` | worker | `up|down`, EX 60 |
| channel `ws:events` | worker + api | `{room, event, payload}` relayed verbatim by the API gateway to socket.io rooms |
| channel `trading:events` | api | `TradingEvent` (`packages/shared`): position/order lifecycle; worker refreshes its in-memory index on receipt |

WS payloads on `ws:events`:
- room `symbol:{S}` event `tick` → `WsTick {s,bid,ask,ts}` (≤ 4/s per symbol)
- room `symbol:{S}` event `candle` → `WsCandle {s,tf,t,o,h,l,c,v,closed}` (live m1 on tick ≤ 2/s; every tf on bar close)
- room `user:{uid}` + `account:{aid}` event `account` → `WsAccountSnapshot` (≤ 2/s per account, worker)
- room `user:{uid}` events `position:opened|position:updated|position:closed` → `PositionDto`; `order:filled|order:cancelled|order:rejected` → `OrderDto` (api)
- room `user:{uid}` event `notice` → `WsNotice` (`margin_call`, `stop_out`, ...)
- room `admin` events `admin:position:event`, `admin:stopout`

## Internal API (worker -> api)
Header `X-Internal-Token: $INTERNAL_TOKEN`. Base `http://localhost:4000/v1/internal/trading`.
| Method + path | Body | Effect |
|---|---|---|
| `POST /close` | `{positionId, reason:'sl'|'tp'|'stopout', quote:{bid,ask,ts}}` | closes the full position at the given quote (buy→bid, sell→ask); ledger `pnl`; idempotent (already closed → 200 with the row) |
| `POST /fill` | `{orderId, quote}` | fills a pending limit/stop order at `fillPrice(side, quote)`; margin re-checked; rejects with `order.rejected` when insufficient |
| `POST /stop-out` | `{accountId}` | api recomputes level from DB + `price:*`; closes worst position first until level > stop-out or none left; WS `notice stop_out`, `admin:stopout` |
| `POST /margin-call` | `{accountId, level}` | sends `notice margin_call` if none sent in the last hour; sets `margin_call_at` |
| `POST /swap` | `{date:'YYYY-MM-DD'}` | accrues nightly swap for every open position (idempotent per date) |
| `GET /index` | — | `{positions:[...open positions], orders:[...pending orders]}` for the worker to (re)build its index |

## Public/owner API (web)
- `GET /market/candles/:symbol?tf=m1&from&to&limit` → `CandleDto[]` (closed bars + current live bar last)
- `GET /market/quotes?symbols=A,B` → `QuoteDto[]`
- `GET /me/accounts/:id/positions?status=open|closed`, `GET /me/accounts/:id/orders?status=`
- `POST /me/accounts/:id/orders` (`placeOrderSchema`) → `PlaceOrderResult`
- `DELETE /me/accounts/:id/orders/:oid`, `PATCH /me/accounts/:id/positions/:pid` (`modifyPositionSchema`), `POST /me/accounts/:id/positions/:pid/close` (`closePositionSchema`) → `ClosePositionResult`
- admin: `GET /admin/positions?open=1&symbol&accountId`, `POST /admin/positions/:id/close {reason}`, `GET /admin/orders?status`

## Rules both sides enforce
- buy fills at **ask**, sell at **bid**; buy exits at bid, sell at ask.
- `required_margin = lots × contract_size × price ÷ min(account.leverage, symbol.leverage_max)`, converted to USD via `toUsd` (EURUSD / USDJPY mid rates from the book). No rate → refuse.
- `equity = balance + credit + Σ floating_usd`; swap is posted to the **ledger** nightly (and mirrored into `position.swap_accrued` for display), so it is already inside `balance`.
- Stop-out closes the most negative floating P/L first; balance is clamped at 0 on stop-out (negative balance protection) with a ledger `adjustment`.
- No trading when the quote is stale, the symbol is disabled, the market session is closed, the account is disabled/`trading_blocked`, or the user is not `active`.

## Env
api: `INTERNAL_TOKEN` (shared secret, ≥ 24 chars). worker: `INTERNAL_TOKEN`, `API_URL` (default http://localhost:4000), `FEED_BINANCE=on|off`, `FEED_SYNTHETIC=on|off`, `REDIS_URL`, `DATABASE_URL`.

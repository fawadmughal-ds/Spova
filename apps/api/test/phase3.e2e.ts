/**
 * Black-box e2e for Phase 3 trading against a running API.
 *   pnpm --filter @spova/api test:e2e:trading
 * Seeds a BTCUSD quote in Redis when none is fresh (so the suite runs without the worker); when the worker is
 * running the live Binance price is used instead, so every assertion is relative to the quote read just before.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Redis from 'ioredis';
import { INTERNAL_TOKEN, REDIS_URL, Session, adminLogin, created, register, resetRateLimits } from './http';

const SYMBOL = 'BTCUSD'; // 24/7, USD-quoted, contract 1, max leverage 1:5, lot step 0.01
const client = new Session();
const other = new Session();
const admin = new Session();
const internal = new Session({ 'X-Internal-Token': INTERNAL_TOKEN });
let accountId = '';
let positionId = '';
const redis = new Redis(REDIS_URL);

const n = (v: string | number) => Number(v);
const pace = () => new Promise((r) => setTimeout(r, 1100)); // order rate limit is 10/s per account
const approx = (a: string | number, b: string | number, tolPct: number, msg?: string) => assert.ok(Math.abs(n(a) - n(b)) <= Math.abs(n(b)) * tolPct, `${msg ?? ''} ${a} vs ${b}`);

async function quote() {
  const r = await client.json('GET', `/market/quotes?symbols=${SYMBOL}`);
  return r.data[0] as { bid: string; ask: string; ts: number; stale: boolean; open: boolean };
}
async function ensureQuote() {
  const q = await quote();
  if (q.stale) {
    await redis.hset(`price:${SYMBOL}`, { bid: '60000.00', ask: '60010.00', ts: String(Date.now()) });
  }
}
async function account() {
  return (await client.json('GET', `/me/accounts/${accountId}`)).data;
}

describe('phase 3: quotes -> orders -> positions -> risk', () => {
  before(async () => {
    await resetRateLimits();
    assert.ok(INTERNAL_TOKEN.length >= 24, 'INTERNAL_TOKEN missing from .env');
    const a = await register(client, 'trader');
    await register(other, 'bystander');
    await adminLogin(admin);
    // trading tests run on a funded demo account (sign-up opens an empty live account)
    accountId = a.me ? (await client.json('POST', '/me/accounts', { type: 'demo' })).data.id : '';
    await ensureQuote();
  });

  it('serves quotes and candles', async () => {
    const q = await quote();
    assert.equal(q.stale, false);
    assert.equal(q.open, true);
    assert.ok(n(q.ask) >= n(q.bid));
    const candles = await client.json('GET', `/market/candles/${SYMBOL}?tf=m1&limit=50`);
    assert.equal(candles.status, 200);
    assert.ok(Array.isArray(candles.data));
    assert.equal((await client.json('GET', `/market/candles/${SYMBOL}?tf=weekly`)).status, 400);
  });

  it('rejects bad orders before touching money', async () => {
    const bad = async (body: unknown) => (await client.json('POST', `/me/accounts/${accountId}/orders`, body));
    assert.equal((await bad({ symbol: 'NOPE', side: 'buy', type: 'market', lots: '0.1' })).data.code, 'symbol_unknown');
    assert.equal((await bad({ symbol: SYMBOL, side: 'buy', type: 'market', lots: '0.001' })).status, 400);
    assert.equal((await bad({ symbol: SYMBOL, side: 'buy', type: 'market', lots: '0.015' })).status, 400, 'lot step');
    assert.equal((await bad({ symbol: SYMBOL, side: 'buy', type: 'market', lots: '999' })).data.code, 'lots_invalid');
    assert.equal((await bad({ symbol: SYMBOL, side: 'buy', type: 'limit', lots: '0.1' })).status, 400, 'limit needs a price');
    const q = await quote();
    const above = (n(q.ask) * 1.05).toFixed(2);
    assert.equal((await bad({ symbol: SYMBOL, side: 'buy', type: 'market', lots: '0.1', sl: above })).data.code, 'sl_tp_invalid');
    assert.equal((await bad({ symbol: SYMBOL, side: 'buy', type: 'limit', lots: '0.1', price: above })).data.code, 'price_invalid');
    assert.equal((await bad({ symbol: SYMBOL, side: 'buy', type: 'market', lots: '20' })).data.code, 'insufficient_margin');
    assert.equal((await other.json('POST', `/me/accounts/${accountId}/orders`, { symbol: SYMBOL, side: 'buy', type: 'market', lots: '0.1' })).status, 404, 'not my account');
  });

  it('fills a market buy at the ask and reserves margin', async () => {
    const before = await account();
    const q = await quote();
    const r = await client.json('POST', `/me/accounts/${accountId}/orders`, { symbol: SYMBOL, side: 'buy', type: 'market', lots: '0.10', clientRef: 'e2e-buy-1' });
    assert.ok(created(r.status), JSON.stringify(r.data));
    assert.equal(r.data.order.status, 'filled');
    assert.ok(r.data.position);
    positionId = r.data.position.id;
    approx(r.data.position.openPrice, q.ask, 0.01, 'open at ask');
    assert.equal(r.data.position.openPrice, r.data.order.filledPrice);
    // leverage = min(100, 5) = 5 -> margin = 0.1 x price / 5
    approx(r.data.position.marginUsed, (0.1 * n(r.data.position.openPrice)) / 5, 0.0001, 'margin');
    approx(r.data.account.usedMargin, r.data.position.marginUsed, 0.0001);
    assert.ok(n(r.data.account.freeMargin) < n(before.freeMargin));
    assert.equal(r.data.account.balance, before.balance, 'balance unchanged on open');

    const again = await client.json('POST', `/me/accounts/${accountId}/orders`, { symbol: SYMBOL, side: 'buy', type: 'market', lots: '0.10', clientRef: 'e2e-buy-1' });
    assert.equal(again.data.order.id, r.data.order.id, 'idempotent clientRef');
    const open = await client.json('GET', `/me/accounts/${accountId}/positions?status=open`);
    assert.equal(open.data.length, 1);
    assert.ok(open.data[0].floatingPnl !== null);
    assert.equal((await other.json('GET', `/me/accounts/${accountId}/positions`)).status, 404);
  });

  it('modifies SL/TP with side checks', async () => {
    const q = await quote();
    const bad = await client.json('PATCH', `/me/accounts/${accountId}/positions/${positionId}`, { sl: (n(q.bid) * 1.1).toFixed(2) });
    assert.equal(bad.data.code, 'sl_tp_invalid');
    const ok = await client.json('PATCH', `/me/accounts/${accountId}/positions/${positionId}`, { sl: (n(q.bid) * 0.9).toFixed(2), tp: (n(q.bid) * 1.1).toFixed(2) });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.ok(ok.data.sl && ok.data.tp);
    const cleared = await client.json('PATCH', `/me/accounts/${accountId}/positions/${positionId}`, { sl: null });
    assert.equal(cleared.data.sl, null);
  });

  it('pending orders: place, fill through the engine, cancel', async () => {
    const q = await quote();
    const limitPrice = (n(q.ask) * 0.9).toFixed(2);
    const lim = await client.json('POST', `/me/accounts/${accountId}/orders`, { symbol: SYMBOL, side: 'buy', type: 'limit', lots: '0.05', price: limitPrice });
    assert.ok(created(lim.status), JSON.stringify(lim.data));
    assert.equal(lim.data.order.status, 'pending');
    assert.equal(lim.data.position, null);
    const stop = await client.json('POST', `/me/accounts/${accountId}/orders`, { symbol: SYMBOL, side: 'sell', type: 'stop', lots: '0.05', price: (n(q.bid) * 0.9).toFixed(2) });
    assert.ok(created(stop.status));
    const pending = await client.json('GET', `/me/accounts/${accountId}/orders?status=pending`);
    assert.equal(pending.data.length, 2);

    // engine says the market reached the limit price
    const fill = await internal.json('POST', '/internal/trading/fill', { orderId: lim.data.order.id, quote: { bid: (n(limitPrice) - 5).toFixed(2), ask: limitPrice, ts: Date.now() } });
    assert.ok(created(fill.status), JSON.stringify(fill.data));
    assert.equal(fill.data.filled, true);
    assert.equal(fill.data.order.status, 'filled');
    assert.equal(n(fill.data.position.openPrice), n(limitPrice));
    assert.equal((await internal.json('POST', '/internal/trading/fill', { orderId: lim.data.order.id, quote: { bid: limitPrice, ask: limitPrice, ts: Date.now() } })).data.filled, false, 'second fill is a no-op');

    const cancel = await client.raw('DELETE', `/me/accounts/${accountId}/orders/${stop.data.order.id}`);
    assert.equal(cancel.status, 200);
    assert.equal((await client.raw('DELETE', `/me/accounts/${accountId}/orders/${stop.data.order.id}`)).status, 409);
    assert.equal((await client.json('GET', `/me/accounts/${accountId}/positions?status=open`)).data.length, 2);
    assert.equal((await internal.json('POST', '/internal/trading/fill', { orderId: stop.data.order.id, quote: { bid: '1', ask: '1', ts: Date.now() } })).data.filled, false);
    assert.equal((await client.json('POST', '/internal/trading/fill', { orderId: stop.data.order.id, quote: { bid: '1', ask: '1', ts: Date.now() } })).status, 401, 'internal needs the token');
  });

  it('partial close realises P/L through the ledger', async () => {
    const before = await account();
    const r = await client.json('POST', `/me/accounts/${accountId}/positions/${positionId}/close`, { lots: '0.04' });
    assert.ok(created(r.status), JSON.stringify(r.data));
    assert.equal(r.data.position.lots, '0.06');
    assert.equal(r.data.position.status, 'open');
    const after = await account();
    approx(n(after.balance) - n(before.balance), r.data.realizedPnl, 0.000001, 'balance moved by realised pnl');
    const ledger = await client.json('GET', `/me/accounts/${accountId}/ledger?limit=3`);
    const pnl = ledger.data.items.find((e: any) => e.type === 'pnl');
    assert.ok(pnl, 'pnl ledger row');
    assert.equal(pnl.refType, 'position');
    assert.equal(pnl.refId, positionId);
    assert.equal((await client.json('POST', `/me/accounts/${accountId}/positions/${positionId}/close`, { lots: '5' })).data.code, 'lots_invalid');
  });

  it('engine close at a take-profit quote pays out exactly (close - open) x lots', async () => {
    const pos = (await client.json('GET', `/me/accounts/${accountId}/positions?status=open`)).data.find((p: any) => p.id === positionId);
    const before = await account();
    const bid = (n(pos.openPrice) + 1000).toFixed(2);
    const r = await internal.json('POST', '/internal/trading/close', { positionId, reason: 'tp', quote: { bid, ask: (n(bid) + 10).toFixed(2), ts: Date.now() } });
    assert.ok(created(r.status), JSON.stringify(r.data));
    assert.equal(r.data.position.status, 'closed');
    assert.equal(r.data.position.closeReason, 'tp');
    assert.equal(n(r.data.position.closePrice), n(bid));
    assert.equal(r.data.realizedPnl, (1000 * 0.06).toFixed(2));
    const after = await account();
    approx(n(after.balance) - n(before.balance), 60, 0.000001);
    const again = await internal.json('POST', '/internal/trading/close', { positionId, reason: 'tp', quote: { bid, ask: bid, ts: Date.now() } });
    assert.equal(again.data.position.status, 'closed', 'idempotent');
    const closed = await client.json('GET', `/me/accounts/${accountId}/positions?status=closed`);
    assert.ok(closed.data.some((p: any) => p.id === positionId));
  });

  it('stop-out closes positions when the margin level collapses and never leaves a negative balance', async () => {
    await pace();
    // start flat: close whatever earlier tests left open
    for (const p of (await client.json('GET', `/me/accounts/${accountId}/positions?status=open`)).data) {
      assert.ok(created((await client.json('POST', `/me/accounts/${accountId}/positions/${p.id}/close`, {})).status));
    }
    const acc = await account();
    const q = await quote();
    // use most of the free margin: lots so that margin ~ 60% of equity
    const lots = Math.max(0.01, Math.floor(((n(acc.freeMargin) * 0.6 * 5) / n(q.ask)) * 100) / 100).toFixed(2);
    const r = await client.json('POST', `/me/accounts/${accountId}/orders`, { symbol: SYMBOL, side: 'buy', type: 'market', lots });
    assert.ok(created(r.status), JSON.stringify(r.data));
    const used = n(r.data.account.usedMargin);
    // drain the balance so equity / used margin < 20%
    const target = used * 0.15;
    const debit = (n(r.data.account.balance) - target).toFixed(2);
    const d = await admin.json('POST', `/admin/accounts/${accountId}/debit`, { amount: debit, reason: 'E2E stop-out setup' });
    assert.ok(created(d.status), JSON.stringify(d.data));
    const level = n((await account()).marginLevel);
    assert.ok(level < 20, `level ${level} should be below stop-out`);

    const so = await internal.json('POST', '/internal/trading/stop-out', { accountId });
    assert.ok(created(so.status), JSON.stringify(so.data));
    assert.ok(so.data.closed.length >= 1);
    const open = await client.json('GET', `/me/accounts/${accountId}/positions?status=open`);
    assert.equal(open.data.length, 0, 'all positions closed');
    const after = await account();
    assert.ok(n(after.balance) >= 0, 'negative balance protection');
    assert.equal(after.marginLevel, null);
    const closed = (await client.json('GET', `/me/accounts/${accountId}/positions?status=closed`)).data;
    assert.ok(closed.some((p: any) => p.closeReason === 'stopout'));
  });

  it('margin call notice is sent at most once per hour; swap is idempotent per date', async () => {
    const first = await internal.json('POST', '/internal/trading/margin-call', { accountId, level: '95' });
    assert.ok(created(first.status));
    assert.equal(first.data.notified, true);
    assert.equal((await internal.json('POST', '/internal/trading/margin-call', { accountId, level: '90' })).data.notified, false);
    const date = '2001-01-01';
    await redis.del(`swap:done:${date}`);
    const s1 = await internal.json('POST', '/internal/trading/swap', { date });
    assert.ok(created(s1.status), JSON.stringify(s1.data));
    assert.equal(s1.data.skipped, false);
    assert.equal((await internal.json('POST', '/internal/trading/swap', { date })).data.skipped, true);
  });

  it('admin sees positions and can force-close with an audit row', async () => {
    await pace();
    const q = await quote();
    const r = await client.json('POST', `/me/accounts/${accountId}/orders`, { symbol: SYMBOL, side: 'sell', type: 'market', lots: '0.01' });
    assert.ok(created(r.status), JSON.stringify(r.data));
    approx(r.data.position.openPrice, q.bid, 0.01, 'sell at bid');
    const list = await admin.json('GET', `/admin/positions?accountId=${accountId}&open=1`);
    assert.equal(list.data.items.length, 1);
    assert.equal((await admin.json('POST', `/admin/positions/${r.data.position.id}/close`, { reason: 'x' })).status, 400);
    const fc = await admin.json('POST', `/admin/positions/${r.data.position.id}/close`, { reason: 'E2E force close' });
    assert.ok(created(fc.status), JSON.stringify(fc.data));
    assert.equal(fc.data.position.closeReason, 'admin');
    const audit = await admin.json('GET', `/admin/audit?targetId=${r.data.position.id}`);
    assert.ok(audit.data.items.some((a: any) => a.action === 'position.force_close'));
    assert.equal((await client.json('GET', '/admin/positions')).status, 403);
  });

  after(async () => {
    await redis.quit();
    await client.raw('POST', '/auth/logout');
    await other.raw('POST', '/auth/logout');
    await admin.raw('POST', '/auth/logout');
  });
});

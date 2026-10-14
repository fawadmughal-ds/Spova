import { test } from 'node:test';
import assert from 'node:assert/strict';
import pino from 'pino';
import type { OrderDto, PositionDto, PriceBook, Quote } from '@spova/shared';
import type { InternalClient } from '../internal-client';
import type { RedisClient } from '../redis';
import type { SymbolRegistry } from '../symbols';
import { TradingIndex } from './index';
import { RiskEngine } from './engine';
import type { TradingIndexDto } from './index-types';

const log = pino({ level: 'silent' });

function fakeRedis() {
  const hashes = new Map<string, Record<string, string>>();
  const published: Array<{ room: string; event: string; payload: any }> = [];
  const sets: string[] = [];
  const self: any = {
    hashes,
    published,
    sets,
    hset: async (k: string, v: Record<string, string>) => {
      hashes.set(k, { ...(hashes.get(k) ?? {}), ...v });
      return 1;
    },
    set: async (k: string) => {
      if (sets.includes(k)) return null;
      sets.push(k);
      return 'OK';
    },
    pipeline: () => {
      const ops: Array<() => void> = [];
      const p: any = {
        hset: (k: string, v: Record<string, string>) => (ops.push(() => void self.hset(k, v)), p),
        publish: (_ch: string, raw: string) => (ops.push(() => published.push(JSON.parse(raw))), p),
        exec: async () => (ops.forEach((f) => f()), []),
      };
      return p;
    },
  };
  return self as RedisClient & { hashes: typeof hashes; published: typeof published; sets: string[] };
}

function fakeApi() {
  const calls: Array<{ path: string; body: any }> = [];
  const api: any = {
    calls,
    index: async () => ({ ok: true, status: 200, body: { accounts: [], positions: [], orders: [] } }),
    close: async (body: any) => (calls.push({ path: '/close', body }), { ok: true, status: 200, body: {} }),
    fill: async (body: any) => (calls.push({ path: '/fill', body }), { ok: true, status: 200, body: {} }),
    stopOut: async (body: any) => (calls.push({ path: '/stop-out', body }), { ok: true, status: 200, body: {} }),
    marginCall: async (body: any) => (calls.push({ path: '/margin-call', body }), { ok: true, status: 200, body: {} }),
  };
  return api as InternalClient & { calls: typeof calls };
}

const pos = (over: Partial<PositionDto>): PositionDto => ({
  id: 'p1',
  accountId: 'a1',
  symbol: 'EURUSD',
  side: 'buy',
  lots: '1.00',
  openPrice: '1.08500',
  openAt: new Date().toISOString(),
  sl: null,
  tp: null,
  marginUsed: '1085.00',
  swapAccrued: '0.00',
  commission: '0.00',
  status: 'open',
  closePrice: null,
  closeAt: null,
  realizedPnl: null,
  closeReason: null,
  currentPrice: null,
  floatingPnl: null,
  ...over,
});
const ord = (over: Partial<OrderDto>): OrderDto => ({
  id: 'o1',
  accountId: 'a1',
  symbol: 'EURUSD',
  side: 'buy',
  type: 'limit',
  lots: '1.00',
  price: '1.08000',
  sl: null,
  tp: null,
  status: 'pending',
  filledPrice: null,
  filledAt: null,
  positionId: null,
  rejectReason: null,
  clientRef: null,
  createdAt: new Date().toISOString(),
  ...over,
});
const dto = (positions: PositionDto[], orders: OrderDto[] = [], acc: Partial<TradingIndexDto['accounts'][number]> = {}): TradingIndexDto => ({
  accounts: [{ id: 'a1', userId: 'u1', balance: '10000.00', credit: '0.00', leverage: 100, tier: 'classic', marginCallPct: '100.00', stopOutPct: '20.00', ...acc }],
  positions,
  orders,
  symbols: [
    { id: 'EURUSD', contractSize: '100000', digits: 5, assetClass: 'forex', leverageMax: 400 },
    { id: 'USDJPY', contractSize: '100000', digits: 3, assetClass: 'forex', leverageMax: 400 },
  ],
});
const q = (bid: string, ask: string): Quote => ({ bid, ask, ts: Date.now() });
const tick = (symbol: string, quote: Quote) => ({ symbol, quote, mid: quote.bid, digits: 5 });
const flush = () => new Promise((r) => setImmediate(r));

function setup(d: TradingIndexDto, book: PriceBook = {}) {
  const redis = fakeRedis();
  const api = fakeApi();
  const index = new TradingIndex(api, log, 60_000);
  const registry = { get: () => undefined } as unknown as SymbolRegistry;
  const engine = new RiskEngine(index, api, redis, book, registry, log, { accountLoopMs: 60_000 });
  index.apply(d);
  return { redis, api, index, engine };
}

test('tick computes floating P/L in USD and writes pos:{id}', async () => {
  const { redis, engine } = setup(dto([pos({})]));
  engine.onTick(tick('EURUSD', q('1.08600', '1.08610')));
  await flush();
  // buy closes at bid: (1.086 - 1.085) * 1 * 100000 = 100 USD
  assert.equal(engine.floating.get('p1')!.toFixed(2), '100.00');
  assert.equal(redis.hashes.get('pos:p1')!.floatingUsd, '100.00');
  assert.equal(redis.hashes.get('pos:p1')!.currentPrice, '1.08600');
});

test('JPY quote currency converts through USDJPY from the book', async () => {
  const book: PriceBook = { USDJPY: q('150.000', '150.000') };
  const { engine } = setup(dto([pos({ id: 'p2', symbol: 'USDJPY', side: 'sell', openPrice: '150.000', marginUsed: '1000.00' })]), book);
  engine.onTick(tick('USDJPY', q('149.000', '149.010')));
  // sell closes at ask: (150.000 - 149.010) * 100000 = 99000 JPY / 150 = 660 USD
  assert.equal(engine.floating.get('p2')!.toFixed(2), '660.00');
});

test('SL hit fires exactly one close even under a tick storm; TP for a sell at ask', async () => {
  const { api, engine } = setup(dto([pos({ id: 'p1', sl: '1.08000' }), pos({ id: 'p3', side: 'sell', openPrice: '1.09000', tp: '1.08100' })]));
  for (let i = 0; i < 5; i++) engine.onTick(tick('EURUSD', q('1.07990', '1.08000')));
  await flush();
  const closes = api.calls.filter((c) => c.path === '/close');
  assert.equal(closes.length, 2);
  const bySide = Object.fromEntries(closes.map((c) => [c.body.positionId, c.body.reason]));
  assert.equal(bySide.p1, 'sl');
  assert.equal(bySide.p3, 'tp');
  assert.equal(closes[0]!.body.quote.bid, '1.07990');
  // position dropped locally -> no more floating
  assert.equal(engine.floating.has('p1'), false);
});

test('no close when neither SL nor TP is reached', async () => {
  const { api, engine } = setup(dto([pos({ sl: '1.08000', tp: '1.09000' })]));
  engine.onTick(tick('EURUSD', q('1.08500', '1.08510')));
  await flush();
  assert.equal(api.calls.length, 0);
});

test('pending limit buy fills once when ask <= price; stop sell when bid <= price', async () => {
  const { api, engine } = setup(dto([], [ord({ id: 'o1', type: 'limit', side: 'buy', price: '1.08000' }), ord({ id: 'o2', type: 'stop', side: 'sell', price: '1.07950' })]));
  engine.onTick(tick('EURUSD', q('1.08000', '1.08010')));
  await flush();
  assert.equal(api.calls.length, 0, 'ask above the limit, nothing yet');
  engine.onTick(tick('EURUSD', q('1.07990', '1.08000')));
  engine.onTick(tick('EURUSD', q('1.07990', '1.08000')));
  await flush();
  assert.deepEqual(api.calls.map((c) => c.body.orderId), ['o1']);
  engine.onTick(tick('EURUSD', q('1.07940', '1.07950')));
  await flush();
  assert.deepEqual(api.calls.map((c) => c.body.orderId), ['o1', 'o2']);
});

test('account loop publishes a snapshot to user and account rooms with correct math', async () => {
  const { redis, engine } = setup(dto([pos({ marginUsed: '1085.00' })], [], { credit: '200.00' }));
  engine.onTick(tick('EURUSD', q('1.08600', '1.08610')));
  await engine.accountLoop();
  await flush();
  const rooms = redis.published.map((p) => p.room).sort();
  assert.deepEqual(rooms, ['account:a1', 'user:u1']);
  const snap = redis.published[0]!.payload;
  assert.equal(snap.equity, '10300.00'); // 10000 + 200 + 100
  assert.equal(snap.usedMargin, '1085.00');
  assert.equal(snap.freeMargin, '9215.00');
  assert.equal(snap.marginLevel, (10300 / 1085 * 100).toFixed(2));
  assert.equal(redis.hashes.get('acct:a1')!.equity, '10300.00');
});

test('swap accrues against equity (not balance) while the trade is open, kept separate from the trade P/L', async () => {
  const { redis, engine } = setup(dto([pos({ marginUsed: '1085.00', swapAccrued: '-25.00' })], [], { credit: '200.00' }));
  engine.onTick(tick('EURUSD', q('1.08600', '1.08610')));
  await engine.accountLoop();
  await flush();
  const snap = redis.published[0]!.payload;
  assert.equal(snap.equity, '10275.00'); // 10000 balance + 200 credit + 100 floating - 25 swap
  assert.equal(snap.freeMargin, '9190.00'); // 10275 - 1085
  // the per-trade floating shown to the client stays price-only; swap is displayed as its own line
  assert.equal(redis.hashes.get('pos:p1')!.floatingUsd, '100.00');
});

test('stop-out when level <= 20%, debounced to one request; margin call once per hour', async () => {
  // balance 1000, margin used 1085 -> a loss of ~800 pushes the level under 20%
  const { api, engine } = setup(dto([pos({ marginUsed: '1085.00' })], [], { balance: '1000.00' }));
  engine.onTick(tick('EURUSD', q('1.07700', '1.07710'))); // floating = -800 -> equity 200 -> level 18.4%
  await engine.accountLoop();
  await engine.accountLoop();
  await flush();
  assert.deepEqual(api.calls.map((c) => c.path), ['/stop-out']);

  const mc = setup(dto([pos({ marginUsed: '1085.00' })], [], { balance: '1000.00' }));
  mc.engine.onTick(tick('EURUSD', q('1.08500', '1.08510'))); // floating 0 -> level 92% -> margin call
  await mc.engine.accountLoop();
  await flush();
  mc.engine.onTick(tick('EURUSD', q('1.08400', '1.08410')));
  await mc.engine.accountLoop();
  await flush();
  assert.deepEqual(mc.api.calls.map((c) => c.path), ['/margin-call']);
  assert.equal(mc.api.calls[0]!.body.accountId, 'a1');
  assert.ok(Number(mc.api.calls[0]!.body.level) < 100);
});

test('index refresh recomputes floating from the book and touches changed accounts', async () => {
  const book: PriceBook = { EURUSD: q('1.08600', '1.08610') };
  const { redis, engine, index } = setup(dto([]), book);
  index.apply(dto([pos({})]));
  assert.equal(engine.floating.get('p1')!.toFixed(2), '100.00');
  await engine.accountLoop();
  await flush();
  assert.equal(redis.published.length, 2);
  // position closed elsewhere -> cache dropped, account touched again
  index.apply(dto([]));
  assert.equal(engine.floating.has('p1'), false);
  await engine.accountLoop();
  await flush();
  assert.equal(redis.published.length, 4);
  assert.equal(redis.published[3]!.payload.equity, '10000.00');
});

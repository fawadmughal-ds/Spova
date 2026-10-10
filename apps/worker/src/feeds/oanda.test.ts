import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OANDA_INSTRUMENTS, parseOandaLine } from './oanda';
import { OANDA_GRANULARITY, parseOandaCandles } from '../candles/backfill';

const map = Object.fromEntries(Object.entries(OANDA_INSTRUMENTS).map(([ours, theirs]) => [theirs, ours]));

test('oanda PRICE lines become ticks with our symbol id and the venue timestamp', () => {
  const t = parseOandaLine('{"type":"PRICE","time":"2026-10-10T12:00:00.123456789Z","bids":[{"price":"1.08561","liquidity":10000000}],"asks":[{"price":"1.08575","liquidity":10000000}],"closeoutBid":"1.08556","closeoutAsk":"1.08580","status":"tradeable","tradeable":true,"instrument":"EUR_USD"}', map);
  assert.deepEqual(t, { symbol: 'EURUSD', bid: '1.08561', ask: '1.08575', ts: Date.parse('2026-10-10T12:00:00.123Z') });
  assert.equal(parseOandaLine('{"type":"PRICE","instrument":"SPX500_USD","time":"2026-10-10T12:00:00Z","bids":[{"price":"5718.0"}],"asks":[{"price":"5718.6"}]}', map)?.symbol, 'US500');
});

test('heartbeats, unknown instruments and garbage are ignored', () => {
  assert.equal(parseOandaLine('{"type":"HEARTBEAT","time":"2026-10-10T12:00:05Z"}', map), null);
  assert.equal(parseOandaLine('{"type":"PRICE","instrument":"ZAR_JPY","bids":[{"price":"1"}],"asks":[{"price":"2"}]}', map), null);
  assert.equal(parseOandaLine('not json', map), null);
  assert.equal(parseOandaLine('{"type":"PRICE","instrument":"EUR_USD"}', map), null, 'no book');
});

test('oanda candles map to UTC buckets, skip the open candle and keep mid OHLC', () => {
  const nowBucket = Math.floor(Date.parse('2026-10-10T12:00:00Z') / 1000);
  const bars = parseOandaCandles('EURUSD', 'm5', [
    { time: '2026-10-10T11:50:00.000000000Z', complete: true, volume: 120, mid: { o: '1.0850', h: '1.0855', l: '1.0848', c: '1.0853' } },
    { time: '2026-10-10T11:55:00.000000000Z', complete: true, volume: 80, mid: { o: '1.0853', h: '1.0856', l: '1.0851', c: '1.0852' } },
    { time: '2026-10-10T12:00:00.000000000Z', complete: false, volume: 3, mid: { o: '1.0852', h: '1.0852', l: '1.0852', c: '1.0852' } },
  ], nowBucket);
  assert.equal(bars.length, 2);
  assert.deepEqual(bars[0], { s: 'EURUSD', tf: 'm5', t: nowBucket - 600, o: '1.0850', h: '1.0855', l: '1.0848', c: '1.0853', v: 120 });
  assert.equal(OANDA_GRANULARITY.d1, 'D');
  assert.equal(OANDA_GRANULARITY.m15, 'M15');
});

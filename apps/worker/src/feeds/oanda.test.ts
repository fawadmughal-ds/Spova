import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OANDA_INSTRUMENTS, parseOandaLine } from './oanda';

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

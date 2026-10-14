import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FINNHUB_SYMBOLS, parseFinnhubFrame } from './finnhub';

const map = Object.fromEntries(Object.entries(FINNHUB_SYMBOLS).map(([ours, theirs]) => [theirs, ours]));

test('finnhub trade frames become one tick per symbol (last trade wins), bid = ask = last price', () => {
  const ticks = parseFinnhubFrame('{"type":"trade","data":[{"p":336.64,"s":"AAPL","t":1791576000123,"v":10},{"p":336.70,"s":"AAPL","t":1791576000456,"v":5},{"p":1.08561,"s":"OANDA:EUR_USD","t":1791576000789,"v":0},{"p":5,"s":"NOT_MAPPED_SYM","t":1,"v":1}]}', map);
  assert.deepEqual(ticks, [
    { symbol: 'AAPL', bid: '336.7', ask: '336.7', ts: 1791576000456 },
    { symbol: 'EURUSD', bid: '1.08561', ask: '1.08561', ts: 1791576000789 },
  ]);
});

test('pings, errors and garbage yield no ticks', () => {
  assert.deepEqual(parseFinnhubFrame('{"type":"ping"}', map), []);
  assert.deepEqual(parseFinnhubFrame('{"type":"error","msg":"Subscribing to too many symbols"}', map), []);
  assert.deepEqual(parseFinnhubFrame('nope', map), []);
});

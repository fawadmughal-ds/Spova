import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OncePer, Throttle } from './throttle';
import { applyMarkup } from './ingest';

test('throttle emits the first value immediately and the last one at the end of the window', async () => {
  let now = 1000;
  const out: Array<[string, number]> = [];
  const th = new Throttle<number>(250, (k, v) => out.push([k, v]), () => now);
  th.push('BTC', 1);
  th.push('BTC', 2);
  th.push('BTC', 3);
  assert.deepEqual(out, [['BTC', 1]]);
  assert.equal(th.pendingCount(), 1);
  now = 1250;
  th.flush('BTC');
  assert.deepEqual(out, [['BTC', 1], ['BTC', 3]]);
  now = 1600;
  th.push('BTC', 4);
  assert.deepEqual(out, [['BTC', 1], ['BTC', 3], ['BTC', 4]]);
});

test('throttle keys are independent', () => {
  const out: string[] = [];
  const th = new Throttle<number>(250, (k) => out.push(k), () => 0);
  th.push('A', 1);
  th.push('B', 1);
  th.push('A', 2);
  assert.deepEqual(out, ['A', 'B']);
  th.flushAll();
  assert.deepEqual(out, ['A', 'B', 'A']);
});

test('throttle respects the rate with real timers (<= 4/s)', async () => {
  const out: number[] = [];
  const th = new Throttle<number>(250, (_k, v) => out.push(v));
  const start = Date.now();
  await new Promise<void>((resolve) => {
    const iv = setInterval(() => {
      if (Date.now() - start >= 600) {
        clearInterval(iv);
        resolve();
        return;
      }
      th.push('S', Date.now() - start);
    }, 15);
  });
  await new Promise((r) => setTimeout(r, 300));
  // emits at ~0, ~250, ~500 and one trailing flush at ~750 for the last pushed value
  assert.ok(out.length >= 3 && out.length <= 4, `emits=${out.length}`);
  assert.ok(out[out.length - 1]! >= 550, 'the last pushed value is delivered');
});

test('OncePer: once per window per key', () => {
  let now = 0;
  const once = new OncePer(3600_000, () => now);
  assert.equal(once.tryAcquire('acc'), true);
  assert.equal(once.tryAcquire('acc'), false);
  assert.equal(once.tryAcquire('other'), true);
  now = 3599_999;
  assert.equal(once.tryAcquire('acc'), false);
  now = 3600_000;
  assert.equal(once.tryAcquire('acc'), true);
});

test('applyMarkup widens the venue quote symmetrically and rounds to digits', () => {
  assert.deepEqual(applyMarkup({ bid: '1.08420', ask: '1.08420' }, '0.00006', 5), { bid: '1.08417', ask: '1.08423', mid: '1.08420' });
  assert.deepEqual(applyMarkup({ bid: '82854.00', ask: '82854.01' }, '8', 2), { bid: '82850.00', ask: '82858.01', mid: '82854.00' });
  assert.deepEqual(applyMarkup({ bid: '149.3201', ask: '149.3201' }, '0.009', 3), { bid: '149.316', ask: '149.325', mid: '149.320' });
});

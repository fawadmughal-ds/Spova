import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CandleAggregator } from './aggregator';

const T0 = Date.UTC(2026, 9, 8, 12, 0, 0); // 12:00:00 UTC, aligned to every tf except h4/d1 (12:00 is 4h aligned too)

test('first tick opens a bar per timeframe with o=h=l=c', () => {
  const agg = new CandleAggregator();
  const { live, closed } = agg.update('EURUSD', '1.08420', T0);
  assert.equal(closed.length, 0);
  assert.equal(live.length, 6);
  for (const b of live) {
    assert.equal(b.o, '1.08420');
    assert.equal(b.h, '1.08420');
    assert.equal(b.l, '1.08420');
    assert.equal(b.c, '1.08420');
    assert.equal(b.v, 1);
  }
  assert.equal(agg.get('EURUSD', 'm1')!.t, T0 / 1000);
  assert.equal(agg.get('EURUSD', 'd1')!.t, Date.UTC(2026, 9, 8) / 1000);
});

test('ticks inside the bucket update h/l/c and the tick count', () => {
  const agg = new CandleAggregator(['m1']);
  agg.update('X', '100.0', T0);
  agg.update('X', '101.5', T0 + 10_000);
  agg.update('X', '99.2', T0 + 20_000);
  const { live } = agg.update('X', '100.7', T0 + 30_000);
  const b = live[0]!;
  assert.deepEqual([b.o, b.h, b.l, b.c, b.v], ['100.0', '101.5', '99.2', '100.7', 4]);
});

test('a tick in the next bucket closes the m1 bar but not the m5 bar', () => {
  const agg = new CandleAggregator(['m1', 'm5']);
  agg.update('X', '100', T0);
  const { live, closed } = agg.update('X', '102', T0 + 61_000);
  assert.equal(closed.length, 1);
  assert.equal(closed[0]!.tf, 'm1');
  assert.equal(closed[0]!.c, '100');
  const m5 = live.find((b) => b.tf === 'm5')!;
  assert.equal(m5.t, T0 / 1000);
  assert.equal(m5.h, '102');
  assert.equal(m5.v, 2);
  const m1 = live.find((b) => b.tf === 'm1')!;
  assert.equal(m1.t, T0 / 1000 + 60);
  assert.equal(m1.o, '102');
});

test('late ticks are ignored', () => {
  const agg = new CandleAggregator(['m1']);
  agg.update('X', '100', T0 + 61_000);
  const { live, closed } = agg.update('X', '50', T0);
  assert.equal(live.length, 0);
  assert.equal(closed.length, 0);
  assert.equal(agg.get('X', 'm1')!.l, '100');
});

test('closeExpired rolls bars whose bucket ended even without a new tick', () => {
  const agg = new CandleAggregator(['m1', 'h1']);
  agg.update('X', '100', T0);
  assert.equal(agg.closeExpired(T0 + 59_999).length, 0);
  const closed = agg.closeExpired(T0 + 60_000);
  assert.equal(closed.length, 1);
  assert.equal(closed[0]!.tf, 'm1');
  assert.equal(agg.get('X', 'm1'), undefined);
  assert.ok(agg.get('X', 'h1'));
});

test('symbols are independent', () => {
  const agg = new CandleAggregator(['m1']);
  agg.update('A', '1', T0);
  agg.update('B', '2', T0);
  assert.equal(agg.get('A', 'm1')!.c, '1');
  assert.equal(agg.get('B', 'm1')!.c, '2');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dec } from '@spova/shared';
import { decideAccountAction, Inflight } from './guards';

const cfg = { marginCallPct: '100.00', stopOutPct: '20.00' };

test('decideAccountAction', () => {
  assert.equal(decideAccountAction(null, cfg), null);
  assert.equal(decideAccountAction(dec(250), cfg), null);
  assert.equal(decideAccountAction(dec(100), cfg), 'margin_call');
  assert.equal(decideAccountAction(dec(55.5), cfg), 'margin_call');
  assert.equal(decideAccountAction(dec(20), cfg), 'stop_out');
  assert.equal(decideAccountAction(dec(-3), cfg), 'stop_out');
});

test('Inflight blocks repeats until end() or ttl', () => {
  let now = 0;
  const f = new Inflight(2000, () => now);
  assert.equal(f.begin('a'), true);
  assert.equal(f.begin('a'), false);
  assert.equal(f.has('a'), true);
  now = 1999;
  assert.equal(f.begin('a'), false);
  now = 2000;
  assert.equal(f.begin('a'), true);
  f.end('a');
  assert.equal(f.begin('a'), true);
});

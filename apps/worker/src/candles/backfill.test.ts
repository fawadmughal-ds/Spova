import { test } from 'node:test';
import assert from 'node:assert/strict';
import pino from 'pino';
import { TIMEFRAMES, bucketStart } from '@spova/shared';
import type { Db } from '../db';
import { isSessionOpen } from '../feeds/sessions';
import { stepPrice } from '../feeds/synthetic';
import type { SymbolRegistry } from '../symbols';
import { CandleBackfill } from './backfill';

const log = pino({ level: 'silent' });
const FX = [
  { weekday: 0, openTime: '22:00', closeTime: '24:00' },
  ...[1, 2, 3, 4].map((weekday) => ({ weekday, openTime: '00:00', closeTime: '24:00' })),
  { weekday: 5, openTime: '00:00', closeTime: '22:00' },
];
const registry = { isOpen: (_id: string, now: Date) => isSessionOpen(FX, now) } as unknown as SymbolRegistry;

test('synthetic history stays bounded, ends at the current price and is time-ascending for every tf', () => {
  const bf = new CandleBackfill({} as Db, registry, log, { minBars: 200, bars: 1500, currentPrice: () => 1.0842 });
  for (const tf of TIMEFRAMES) {
    const bars = bf.synthetic('EURUSD', 'forex', 5, tf);
    assert.equal(bars.length, 1500, tf);
    assert.equal(bars[bars.length - 1]!.c, '1.08420');
    for (let i = 1; i < bars.length; i++) {
      const prev = bars[i - 1]!;
      const b = bars[i]!;
      assert.ok(b.t > prev.t, `${tf} ascending`);
      assert.equal(bucketStart(b.t * 1000, tf), b.t, `${tf} aligned`);
      assert.equal(b.o, prev.c, `${tf} continuous`);
      assert.ok(Number(b.l) <= Math.min(Number(b.o), Number(b.c)) && Number(b.h) >= Math.max(Number(b.o), Number(b.c)), `${tf} ohlc sane`);
      assert.ok(Number(b.l) > 0.5 && Number(b.h) < 2.2, `${tf} bounded: ${b.l}..${b.h}`);
    }
  }
});

test('synthetic history skips closed sessions (no weekend bars for fx)', () => {
  const bf = new CandleBackfill({} as Db, registry, log, { minBars: 200, bars: 400, currentPrice: () => 1.0842 });
  const bars = bf.synthetic('EURUSD', 'forex', 5, 'h1');
  for (const b of bars) assert.ok(isSessionOpen(FX, new Date(b.t * 1000)), `bar at ${new Date(b.t * 1000).toISOString()} inside the session`);
});

test('stepPrice never explodes even with a huge dt relative to the half-life', () => {
  let p = 100;
  for (let i = 0; i < 10_000; i++) p = stepPrice({ price: p, anchor: 100, annualVol: 0.3, dtSec: 86_400, halfLifeSec: 3600 });
  assert.ok(p > 20 && p < 500, `price ${p}`);
});

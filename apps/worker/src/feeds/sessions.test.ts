import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSessionOpen } from './sessions';

const FX = [
  { weekday: 0, openTime: '22:00', closeTime: '24:00' },
  ...[1, 2, 3, 4].map((weekday) => ({ weekday, openTime: '00:00', closeTime: '24:00' })),
  { weekday: 5, openTime: '00:00', closeTime: '22:00' },
];
const STOCK = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, openTime: '13:30', closeTime: '20:00' }));

test('no rows = 24/7', () => {
  assert.equal(isSessionOpen([], new Date(Date.UTC(2026, 9, 10, 3))), true); // Saturday
});

test('fx: open Sun 22:00 -> Fri 22:00, closed over the weekend', () => {
  assert.equal(isSessionOpen(FX, new Date(Date.UTC(2026, 9, 4, 21, 59))), false); // Sun 21:59
  assert.equal(isSessionOpen(FX, new Date(Date.UTC(2026, 9, 4, 22, 0))), true); // Sun 22:00
  assert.equal(isSessionOpen(FX, new Date(Date.UTC(2026, 9, 7, 12))), true); // Wed
  assert.equal(isSessionOpen(FX, new Date(Date.UTC(2026, 9, 9, 21, 59))), true); // Fri 21:59
  assert.equal(isSessionOpen(FX, new Date(Date.UTC(2026, 9, 9, 22, 0))), false); // Fri 22:00
  assert.equal(isSessionOpen(FX, new Date(Date.UTC(2026, 9, 10, 12))), false); // Sat
});

test('stocks: weekday 13:30-20:00 only', () => {
  assert.equal(isSessionOpen(STOCK, new Date(Date.UTC(2026, 9, 8, 13, 29))), false);
  assert.equal(isSessionOpen(STOCK, new Date(Date.UTC(2026, 9, 8, 13, 30))), true);
  assert.equal(isSessionOpen(STOCK, new Date(Date.UTC(2026, 9, 8, 19, 59))), true);
  assert.equal(isSessionOpen(STOCK, new Date(Date.UTC(2026, 9, 8, 20, 0))), false);
  assert.equal(isSessionOpen(STOCK, new Date(Date.UTC(2026, 9, 11, 15))), false); // Sunday
});

test('a window wrapping past midnight stays open into the next weekday', () => {
  const rows = [{ weekday: 1, openTime: '23:00', closeTime: '02:00' }];
  assert.equal(isSessionOpen(rows, new Date(Date.UTC(2026, 9, 5, 23, 30))), true); // Mon 23:30
  assert.equal(isSessionOpen(rows, new Date(Date.UTC(2026, 9, 6, 1, 30))), true); // Tue 01:30
  assert.equal(isSessionOpen(rows, new Date(Date.UTC(2026, 9, 6, 2, 0))), false); // Tue 02:00
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import pino from 'pino';
import { InternalClient } from './internal-client';

const log = pino({ level: 'silent' });

function mockFetch(responses: Array<{ status: number; body?: unknown } | Error>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const f = (async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    if (next instanceof Error) throw next;
    return new Response(next.body === undefined ? '' : JSON.stringify(next.body), { status: next.status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { f, calls };
}

test('sends the token header and parses JSON', async () => {
  const { f, calls } = mockFetch([{ status: 200, body: { accounts: [], positions: [], orders: [] } }]);
  const c = new InternalClient(log, { baseUrl: 'http://api:4000/', token: 'secret-token', fetchImpl: f, backoffMs: 1 });
  const res = await c.index();
  assert.equal(res.ok, true);
  assert.deepEqual(res.body, { accounts: [], positions: [], orders: [] });
  assert.equal(calls[0]!.url, 'http://api:4000/v1/internal/trading/index');
  assert.equal((calls[0]!.init.headers as Record<string, string>)['x-internal-token'], 'secret-token');
});

test('retries 5xx and network errors with backoff, then succeeds', async () => {
  const { f, calls } = mockFetch([{ status: 503 }, new Error('ECONNREFUSED'), { status: 200, body: { ok: 1 } }]);
  const c = new InternalClient(log, { baseUrl: 'http://api', token: 't', fetchImpl: f, backoffMs: 1, retries: 3 });
  const res = await c.swap({ date: '2026-10-08' });
  assert.equal(res.ok, true);
  assert.equal(calls.length, 3);
  assert.equal(JSON.parse(calls[0]!.init.body as string).date, '2026-10-08');
});

test('4xx is not retried and comes back as ok:false', async () => {
  const { f, calls } = mockFetch([{ status: 409, body: { code: 'already_closed' } }]);
  const c = new InternalClient(log, { baseUrl: 'http://api', token: 't', fetchImpl: f, backoffMs: 1 });
  const res = await c.close({ positionId: 'p', reason: 'sl', quote: { bid: '1', ask: '2', ts: 1 } });
  assert.equal(res.ok, false);
  assert.equal(res.status, 409);
  assert.equal(calls.length, 1);
});

test('gives up after the retry budget', async () => {
  const { f, calls } = mockFetch([{ status: 500 }, { status: 500 }, { status: 500 }]);
  const c = new InternalClient(log, { baseUrl: 'http://api', token: 't', fetchImpl: f, backoffMs: 1, retries: 2 });
  await assert.rejects(() => c.stopOut({ accountId: 'a' }));
  assert.equal(calls.length, 3);
});

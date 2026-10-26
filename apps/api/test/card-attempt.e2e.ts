/**
 * Card deposit attempts in TEST MODE (no payment gateway connected).
 *
 * With no gateway, POST /me/payments/card/attempt records the attempt with brand + last4 only and
 * declines it deterministically. These tests cover: a simulated attempt is recorded, the result is a
 * rejection (status=declined, testMode=true, code=TEST_DECLINED, no funds moved), and invalid input
 * (bad metadata / a full card number) is refused by the schema. They run against the usual dev stack
 * (no Stripe keys needed — the attempt path is used precisely when no gateway is configured).
 */
import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CARD_TEST_DECLINE_CODE } from '@spova/shared';
import { Session, created, register, resetRateLimits } from './http';

describe('card deposit attempts (test mode, no gateway)', () => {
  const client = new Session();
  let liveAccountId = '';

  before(async () => {
    await resetRateLimits();
    await register(client, 'card');
    // sign-up opens the LIVE account that card deposits need
    const accounts = await client.json('GET', '/me/accounts');
    liveAccountId = accounts.data.live[0].id;
  });

  const attempt = (body: unknown) => client.json('POST', '/me/payments/card/attempt', body);
  const validBody = () => ({ accountId: liveAccountId, amount: '200', card: { brand: 'visa', last4: '4242', name: 'E2e Card' } });

  it('records a simulated attempt and returns it in payment history', async () => {
    const r = await attempt(validBody());
    assert.ok(created(r.status), JSON.stringify(r.data));
    assert.equal(r.data.method, 'card');
    assert.equal(r.data.amount, '200.00');
    assert.equal(r.data.card.brand, 'visa');
    assert.equal(r.data.card.last4, '4242');

    // the attempt is persisted and shows in the client's own payment history
    const list = await client.json('GET', '/me/payments?kind=deposit');
    assert.ok(created(list.status), JSON.stringify(list.data));
    const found = list.data.items.find((p: { id: string }) => p.id === r.data.id);
    assert.ok(found, 'recorded attempt should appear in payment history');
    assert.equal(found.testMode, true);
  });

  it('declines the attempt deterministically (test-mode decline, no funds moved)', async () => {
    const before = await client.json('GET', '/me/accounts');
    const balBefore = before.data.live.find((a: { id: string }) => a.id === liveAccountId).balance;

    const r = await attempt(validBody());
    assert.ok(created(r.status), JSON.stringify(r.data));
    assert.equal(r.data.status, 'declined');
    assert.equal(r.data.testMode, true);
    assert.equal(r.data.card.code, CARD_TEST_DECLINE_CODE);
    assert.ok(r.data.decidedAt, 'a declined attempt carries a decision timestamp');
    assert.equal(r.data.ledgerEntryId, null, 'no ledger entry — no money moved');

    const after = await client.json('GET', '/me/accounts');
    const balAfter = after.data.live.find((a: { id: string }) => a.id === liveAccountId).balance;
    assert.equal(balAfter, balBefore, 'balance is unchanged by a declined test attempt');
  });

  it('rejects invalid input', async () => {
    // last4 must be exactly 4 digits
    assert.equal((await attempt({ accountId: liveAccountId, amount: '200', card: { brand: 'visa', last4: '12' } })).status, 400);
    // an unknown card brand is refused
    assert.equal((await attempt({ accountId: liveAccountId, amount: '200', card: { brand: 'notabrand', last4: '4242' } })).status, 400);
    // the full card number / CVV / expiry can never be submitted (strict schema)
    assert.equal((await attempt({ accountId: liveAccountId, amount: '200', card: { brand: 'visa', last4: '4242', number: '4242424242424242', cvv: '123' } })).status, 400);
    // amount below the card minimum
    assert.equal((await attempt({ accountId: liveAccountId, amount: '5', card: { brand: 'visa', last4: '4242' } })).status, 400);
  });
});

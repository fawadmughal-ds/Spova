/**
 * Card deposits through the gateway webhook (success, decline, unexpected errors).
 *
 * The browser confirms the card with the provider directly, so card numbers and CVVs never reach us.
 * These tests drive the provider -> us webhook with a locally signed payload (Stripe's test header helper),
 * which needs no network and no live account. They only run when STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET
 * are set (CI sets test values); otherwise they are skipped.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { ADMIN_EMAIL, ADMIN_PASSWORD, API, Session, created, register, resetRateLimits } from './http';

const SECRET = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const enabled = !!SECRET && !!WEBHOOK_SECRET;

describe('card deposits via the gateway webhook', { skip: enabled ? false : 'STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET not set' }, () => {
  const client = new Session();
  const stripe = new Stripe(SECRET || 'sk_test_placeholder');
  let liveAccountId = '';

  /** POST a provider event to the webhook with a valid signature over the exact raw body (no network). */
  async function postWebhook(event: Record<string, unknown>, opts: { badSignature?: boolean; noSignature?: boolean } = {}) {
    const payload = JSON.stringify(event);
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (!opts.noSignature) {
      const secret = opts.badSignature ? 'whsec_wrong_secret_value' : WEBHOOK_SECRET!;
      headers['stripe-signature'] = stripe.webhooks.generateTestHeaderString({ payload, secret });
    }
    const res = await fetch(`${API}/payments/webhooks/stripe`, { method: 'POST', headers, body: payload });
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : undefined };
  }

  /** Open a pending card deposit and return its request id. */
  async function openCardDeposit(amount: string) {
    const dep = await client.json<{ id: string; status: string; method: string }>('POST', '/me/payments/deposit', { accountId: liveAccountId, amount, method: 'card' });
    assert.ok(created(dep.status), `open card deposit: ${JSON.stringify(dep.data)}`);
    assert.equal(dep.data.status, 'pending');
    return dep.data.id;
  }

  const succeeded = (requestId: string, cents: number) => ({
    id: `evt_${Math.random().toString(36).slice(2)}`,
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: `pi_${Math.random().toString(36).slice(2)}`,
        object: 'payment_intent',
        amount_received: cents,
        currency: 'usd',
        customer: 'cus_e2e_1',
        metadata: { requestId },
        charges: { data: [{ payment_method_details: { card: { brand: 'visa', last4: '4242' } }, billing_details: { name: 'E2E Card' }, outcome: { network_status: 'approved_by_network' } }] },
      },
    },
  });

  const failed = (requestId: string) => ({
    id: `evt_${Math.random().toString(36).slice(2)}`,
    type: 'payment_intent.payment_failed',
    data: {
      object: {
        id: `pi_${Math.random().toString(36).slice(2)}`,
        object: 'payment_intent',
        currency: 'usd',
        metadata: { requestId },
        last_payment_error: { code: 'card_declined', decline_code: 'insufficient_funds', message: 'Your card has insufficient funds.', payment_method: { card: { brand: 'mastercard', last4: '0002' } } },
      },
    },
  });

  const balance = async () => (await client.json<{ balance: string }>('GET', `/me/accounts/${liveAccountId}`)).data.balance;
  const findRequest = async (id: string) => {
    const list = await client.json<{ items: Array<{ id: string; status: string; card: { brand: string | null; last4: string | null; code: string | null } | null }> }>('GET', '/me/payments?kind=deposit&limit=50');
    return list.data.items.find((r) => r.id === id);
  };

  before(async () => {
    await resetRateLimits();
    // make sure the card deposit channel is on so a pending card request can be opened for the webhook to settle
    const admin = new Session();
    await admin.json('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const cfg = await admin.json<any>('GET', '/admin/payments/channels');
    await admin.json('PUT', '/admin/payments/channels', { ...cfg.data, card: { ...cfg.data.card, enabled: true } });
    await register(client, 'card');
    // sign-up opens the LIVE account that card deposits need
    const accounts = await client.json<{ live: { id: string }[] }>('GET', '/me/accounts');
    liveAccountId = accounts.data.live[0].id;
  });
  after(async () => {
    await resetRateLimits();
  });

  it('a succeeded payment is credited once and stores only safe card metadata', async () => {
    const start = Number(await balance());
    const id = await openCardDeposit('500');

    const ok = await postWebhook(succeeded(id, 50000));
    assert.ok(created(ok.status), `webhook: ${JSON.stringify(ok.data)}`);
    assert.equal(ok.data.handled, 'payment_intent.succeeded');

    assert.equal(Number(await balance()), start + 500, 'balance credited by the paid amount');
    const req = await findRequest(id);
    assert.equal(req?.status, 'approved');
    assert.equal(req?.card?.brand, 'visa');
    assert.equal(req?.card?.last4, '4242');
    assert.ok(req?.card?.code, 'an approval code is stored');
    // the stored record must not carry the full number or a cvv anywhere
    assert.ok(!JSON.stringify(req).match(/cvv|4242424242424242/i), 'no PAN or CVV is exposed');

    // idempotent: replaying the same success does not credit twice
    const replay = await postWebhook(succeeded(id, 50000));
    assert.ok(created(replay.status));
    assert.equal(Number(await balance()), start + 500, 'no double credit on replay');
  });

  it('a declined payment moves no money and records the decline code', async () => {
    const start = Number(await balance());
    const id = await openCardDeposit('400');

    const res = await postWebhook(failed(id));
    assert.ok(created(res.status), `webhook: ${JSON.stringify(res.data)}`);
    assert.equal(res.data.handled, 'payment_intent.payment_failed');

    assert.equal(Number(await balance()), start, 'a declined card never credits the account');
    const req = await findRequest(id);
    assert.equal(req?.status, 'declined');
    assert.equal(req?.card?.code, 'insufficient_funds');
    assert.equal(req?.card?.last4, '0002');
  });

  it('unexpected / malformed events are handled safely and never move money', async () => {
    const start = Number(await balance());

    // no signature and a bad signature are both rejected
    assert.equal((await postWebhook(succeeded('x', 50000), { noSignature: true })).status, 400);
    assert.equal((await postWebhook(succeeded('x', 50000), { badSignature: true })).status, 400);

    // a well-signed event for a request that does not exist is accepted but changes nothing
    const unknown = await postWebhook(succeeded('00000000-0000-0000-0000-000000000000', 50000));
    assert.ok(created(unknown.status));

    // a well-signed event with no requestId metadata is ignored
    const noMeta = await postWebhook({ id: 'evt_nometa', type: 'payment_intent.succeeded', data: { object: { id: 'pi_x', object: 'payment_intent', amount_received: 50000, currency: 'usd', metadata: {} } } });
    assert.ok(created(noMeta.status));
    assert.equal(noMeta.data.handled, 'no-request');

    // an event type we do not act on is ignored
    const other = await postWebhook({ id: 'evt_other', type: 'charge.refunded', data: { object: { id: 'ch_x' } } });
    assert.ok(created(other.status));
    assert.equal(other.data.handled, 'ignored');

    assert.equal(Number(await balance()), start, 'none of these moved money');
  });
});

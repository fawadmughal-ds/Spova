/**
 * Black-box end-to-end tests for Phase 2 (KYC, payments queue, support tickets) against a running API.
 *   pnpm --filter @spova/api test:e2e            (API_URL defaults to http://localhost:4000)
 * Creates throw-away client users; approvals post real ledger rows on those users' accounts only.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Session, adminLogin, register, resetRateLimits } from './http';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

function upload(group: string, docType: string, bytes: Buffer, mime: string, name: string) {
  const fd = new FormData();
  fd.set('group', group);
  fd.set('docType', docType);
  fd.set('file', new Blob([bytes], { type: mime }), name);
  return fd;
}

async function register(s: Session, tag: string) {
  const email = `e2e+${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@xyz.local`;
  const r = await s.json('POST', '/auth/register', {
    email,
    password: 'E2e!Passw0rd',
    firstName: 'E2e',
    lastName: tag,
    phone: '+971501234567',
    dob: '1990-01-01',
    countryCode: 'AE',
    tcAccepted: true,
    riskAccepted: true,
  });
  assert.equal(r.status, 201, `register: ${JSON.stringify(r.data)}`);
  return { email, me: r.data };
}

const client = new Session();
const other = new Session();
const admin = new Session();
let clientId = '';
let demoAccountId = '';
let liveAccountId = '';
let poiDocId = '';

describe('phase 2: kyc -> live account -> payments -> tickets', () => {
  before(async () => {
    await resetRateLimits();
    const a = await register(client, 'client');
    clientId = a.me.id;
    await register(other, 'other');
    await adminLogin(admin);
    const accounts = await client.json('GET', '/me/accounts');
    demoAccountId = accounts.data.demo[0].id;
  });

  // ---------------------------------------------------------------- KYC
  it('starts unverified and cannot see admin queues', async () => {
    const me = await client.json('GET', '/auth/me');
    assert.deepEqual(me.data.kyc, { poi: false, por: false, payment: false });
    assert.equal((await client.json('GET', '/me/kyc/status')).data.poi, 'incomplete');
    assert.equal((await client.json('GET', '/admin/kyc')).status, 403);
    assert.equal((await client.json('GET', '/admin/payments')).status, 403);
  });

  it('rejects bad uploads', async () => {
    const wrongType = await client.json('POST', '/me/kyc/documents', upload('poi', 'utility_bill', PNG, 'image/png', 'x.png'));
    assert.equal(wrongType.status, 400);
    const fake = await client.json('POST', '/me/kyc/documents', upload('poi', 'passport', Buffer.from('MZ not really an image at all'), 'image/png', 'x.png'));
    assert.equal(fake.status, 400);
    assert.equal(fake.data.code, 'file_type');
    const noFile = await client.json('POST', '/me/kyc/documents', (() => { const fd = new FormData(); fd.set('group', 'poi'); fd.set('docType', 'passport'); return fd; })());
    assert.equal(noFile.status, 400);
  });

  it('uploads a POI document, serves it to the owner only', async () => {
    const r = await client.json('POST', '/me/kyc/documents', upload('poi', 'passport', PNG, 'image/png', 'passport.png'));
    assert.ok([200, 201].includes(r.status), JSON.stringify(r.data));
    assert.equal(r.data.status, 'pending');
    assert.equal(r.data.mime, 'image/png');
    poiDocId = r.data.id;
    assert.equal((await client.json('GET', '/me/kyc/status')).data.poi, 'pending');
    assert.equal((await client.json('GET', '/me/kyc/documents')).data.length, 1);

    const file = await client.raw('GET', `/me/kyc/documents/${poiDocId}/file`);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type'), 'image/png');
    assert.equal(Buffer.from(await file.arrayBuffer()).equals(PNG), true);
    assert.equal((await other.raw('GET', `/me/kyc/documents/${poiDocId}/file`)).status, 404);
  });

  it('blocks live account and real-money deposits before verification', async () => {
    const live = await client.json('POST', '/me/accounts', { type: 'live' });
    assert.equal(live.status, 403);
    assert.equal(live.data.code, 'kyc_required');
    const dep = await client.json('POST', '/me/payments/deposit', { accountId: demoAccountId, amount: '500', method: 'bank' });
    assert.equal(dep.status, 422);
    assert.equal(dep.data.code, 'demo_account');
  });

  it('admin sees the queue and rejects with a reason', async () => {
    const q = await admin.json('GET', `/admin/kyc?status=pending&userId=${clientId}`);
    assert.equal(q.status, 200);
    assert.equal(q.data.items.length, 1);
    assert.equal(q.data.items[0].user.id, clientId);
    const adminFile = await admin.raw('GET', `/admin/kyc/${poiDocId}/file`);
    assert.equal(adminFile.status, 200);

    const noReason = await admin.json('PATCH', `/admin/kyc/${poiDocId}`, { status: 'rejected' });
    assert.equal(noReason.status, 400);
    const rej = await admin.json('PATCH', `/admin/kyc/${poiDocId}`, { status: 'rejected', reason: 'Photo is blurred' });
    assert.equal(rej.status, 200);
    assert.equal(rej.data.status, 'rejected');
    assert.equal(rej.data.rejectReason, 'Photo is blurred');
    assert.equal((await client.json('GET', '/me/kyc/status')).data.poi, 'rejected');
    assert.equal((await admin.json('PATCH', `/admin/kyc/${poiDocId}`, { status: 'approved' })).status, 409);
  });

  it('approving POI and POR sets the user flags', async () => {
    const poi = await client.json('POST', '/me/kyc/documents', upload('poi', 'id_card', PNG, 'image/png', 'id.png'));
    const por = await client.json('POST', '/me/kyc/documents', upload('por', 'bank_statement', PDF, 'application/pdf', 'statement.pdf'));
    assert.ok([200, 201].includes(poi.status));
    assert.ok([200, 201].includes(por.status));
    assert.equal(por.data.mime, 'application/pdf');
    for (const id of [poi.data.id, por.data.id]) {
      const r = await admin.json('PATCH', `/admin/kyc/${id}`, { status: 'approved' });
      assert.equal(r.status, 200, JSON.stringify(r.data));
    }
    const me = await client.json('GET', '/auth/me');
    assert.deepEqual(me.data.kyc, { poi: true, por: true, payment: false });
    const st = await client.json('GET', '/me/kyc/status');
    assert.equal(st.data.poi, 'approved');
    assert.equal(st.data.por, 'approved');
    assert.equal(st.data.payment, 'incomplete');
  });

  // ---------------------------------------------------------------- payments
  it('opens a live account and validates deposit requests', async () => {
    const live = await client.json('POST', '/me/accounts', { type: 'live' });
    assert.ok([200, 201].includes(live.status), JSON.stringify(live.data));
    liveAccountId = live.data.id;
    const methods = await client.json('GET', '/me/payments/methods');
    assert.ok(methods.data.find((m: any) => m.id === 'bank' && m.enabled));

    assert.equal((await client.json('POST', '/me/payments/deposit', { accountId: liveAccountId, amount: '100', method: 'bank' })).data.code, 'amount_min');
    const cardReq = await client.json('POST', '/me/payments/deposit', { accountId: liveAccountId, amount: '500', method: 'card' });
    assert.ok([200, 201].includes(cardReq.status), 'card deposits are accepted (payment-link flow) by default');
    await client.json('POST', `/me/payments/${cardReq.data.id}/cancel`);
    assert.equal((await client.json('POST', '/me/payments/deposit', { accountId: liveAccountId, amount: '12.345', method: 'bank' })).status, 400);
    const otherAcc = await other.json('POST', '/me/payments/deposit', { accountId: liveAccountId, amount: '500', method: 'bank' });
    assert.equal(otherAcc.status, 404, 'cannot deposit to someone else\'s account');

    const dep = await client.json('POST', '/me/payments/deposit', { accountId: liveAccountId, amount: '500', method: 'bank', reference: 'TRX-1' });
    assert.ok([200, 201].includes(dep.status), JSON.stringify(dep.data));
    assert.equal(dep.data.status, 'pending');
    assert.equal(dep.data.amount, '500.00');

    const wd = await client.json('POST', '/me/payments/withdraw', { accountId: liveAccountId, amount: '100', method: 'bank', destination: { label: 'My bank', details: 'AE07 0331 2345 6789 0123 456' } });
    assert.equal(wd.status, 422);
    assert.equal(wd.data.code, 'insufficient_funds');

    const list = await client.json('GET', '/me/payments?status=pending');
    assert.equal(list.data.total, 1, 'the cancelled card request is not pending');
  });

  it('admin approves the deposit and the ledger moves the balance', async () => {
    const q = await admin.json('GET', `/admin/payments?status=pending&userId=${clientId}`);
    assert.equal(q.data.items.length, 1);
    const id = q.data.items[0].id;
    assert.equal(q.data.items[0].account.balance, '0.00');

    const ok = await admin.json('PATCH', `/admin/payments/${id}`, { status: 'approved' });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.equal(ok.data.status, 'approved');
    assert.ok(ok.data.ledgerEntryId);
    assert.equal((await admin.json('PATCH', `/admin/payments/${id}`, { status: 'declined', note: 'again' })).status, 409);

    const acc = await client.json('GET', `/me/accounts/${liveAccountId}`);
    assert.equal(acc.data.balance, '500.00');
    const ledger = await client.json('GET', `/me/accounts/${liveAccountId}/ledger`);
    assert.equal(ledger.data.items[0].type, 'deposit');
    assert.equal(ledger.data.items[0].refType, 'payment_request');
    assert.equal(ledger.data.items[0].refId, id);
    const audit = await admin.json('GET', `/admin/audit?targetId=${id}`);
    assert.ok(audit.data.items.some((a: any) => a.action === 'payment.approve'));
  });

  it('deposit channels: methods carry pay-to details; proof slip uploads and streams to owner + admin; admin edits channels', async () => {
    const methods = await client.json('GET', '/me/payments/methods');
    const bank = methods.data.find((m: any) => m.id === 'bank');
    assert.ok(bank.deposit && bank.deposit.fields.some((f: any) => f.label === 'Account number'), 'bank pay-to details');
    const upi = methods.data.find((m: any) => m.id === 'upi');
    assert.ok(upi.enabled && upi.deposit.qr?.startsWith('upi://pay?pa='), 'upi QR payload');

    const dep = await client.json('POST', '/me/payments/deposit', { accountId: liveAccountId, amount: '250', method: 'upi', reference: 'UTR-42' });
    assert.ok([200, 201].includes(dep.status), JSON.stringify(dep.data));
    assert.equal(dep.data.proof, null);
    assert.equal((await client.json('GET', `/me/payments/${dep.data.id}/proof`)).status, 404, 'no proof yet');

    const fd = new FormData();
    fd.set('file', new Blob([PNG], { type: 'image/png' }), 'upi-success.png');
    const up = await client.json('POST', `/me/payments/${dep.data.id}/proof`, fd);
    assert.ok([200, 201].includes(up.status), JSON.stringify(up.data));
    assert.equal(up.data.proof.name, 'upi-success.png');
    assert.equal(up.data.proof.mime, 'image/png');
    const bad = new FormData();
    bad.set('file', new Blob([Buffer.from('MZ nope')], { type: 'image/png' }), 'x.png');
    assert.equal((await client.json('POST', `/me/payments/${dep.data.id}/proof`, bad)).status, 400);

    const mine = await client.raw('GET', `/me/payments/${dep.data.id}/proof`);
    assert.equal(mine.status, 200);
    assert.equal(mine.headers.get('content-type'), 'image/png');
    assert.equal((await other.raw('GET', `/me/payments/${dep.data.id}/proof`)).status, 404, 'not the owner');
    const theirs = await admin.raw('GET', `/admin/payments/${dep.data.id}/proof`);
    assert.equal(theirs.status, 200);
    const queued = await admin.json('GET', '/admin/payments?status=pending&kind=deposit');
    assert.ok(queued.data.items.some((r: any) => r.id === dep.data.id && r.proof?.name === 'upi-success.png'));
    assert.equal((await client.json('POST', `/me/payments/${dep.data.id}/cancel`)).data.status, 'cancelled');
    assert.equal((await client.json('POST', `/me/payments/${dep.data.id}/proof`, fd)).status, 409, 'no proof on a decided request');

    const cfg = await admin.json('GET', '/admin/payments/channels');
    assert.equal(cfg.status, 200);
    assert.equal(cfg.data.card.enabled, true);
    const saved = await admin.json('PUT', '/admin/payments/channels', { ...cfg.data, card: { ...cfg.data.card, enabled: false }, upi: { ...cfg.data.upi, vpa: 'broker@upi' } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const after = await client.json('GET', '/me/payments/methods');
    assert.ok(!after.data.find((m: any) => m.id === 'card').enabled, 'card switched off by the admin');
    assert.ok(after.data.find((m: any) => m.id === 'upi').deposit.fields.some((f: any) => f.value === 'broker@upi'));
    assert.equal((await client.json('POST', '/me/payments/deposit', { accountId: liveAccountId, amount: '300', method: 'card' })).data.code, 'method_unavailable');
    const restored = await admin.json('PUT', '/admin/payments/channels', cfg.data);
    assert.equal(restored.status, 200);
    const cardDep = await client.json('POST', '/me/payments/deposit', { accountId: liveAccountId, amount: '300', method: 'card' });
    assert.ok([200, 201].includes(cardDep.status), JSON.stringify(cardDep.data));
    await client.json('POST', `/me/payments/${cardDep.data.id}/cancel`);
    assert.equal((await client.json('PUT', '/admin/payments/channels', cfg.data)).status, 403, 'clients cannot edit channels');
  });

  it('cashier: footer + fx rates, card intent refuses without a gateway, webhook refuses unsigned calls', async () => {
    const info = await client.json('GET', '/me/payments/cashier');
    assert.equal(info.status, 200);
    assert.equal(typeof info.data.footer, 'string');
    assert.equal(info.data.fx.USD, 1);
    const methods = await client.json('GET', '/me/payments/methods');
    const card = methods.data.find((m: any) => m.id === 'card');
    assert.equal(card.gateway, undefined, 'no gateway configured in this environment');
    const intent = await client.json('POST', '/me/payments/card/intent', { accountId: liveAccountId, amount: '250' });
    assert.equal(intent.status, 503);
    assert.equal(intent.data.code, 'gateway_not_configured');
    const before = await client.json('GET', '/me/payments?kind=deposit&status=pending');
    assert.ok(!before.data.items.some((r: any) => r.method === 'card' && r.amount === '250.00'), 'no request is opened when the gateway is off');
    const hook = await new Session().raw('POST', '/payments/webhooks/stripe', { id: 'evt_x', type: 'payment_intent.succeeded' });
    assert.ok([400, 503].includes(hook.status), `webhook without signature must be rejected, got ${hook.status}`);
  });

  it('withdrawals: pending amounts reserve funds, cancel, approve, decline', async () => {
    const w1 = await client.json('POST', '/me/payments/withdraw', { accountId: liveAccountId, amount: '100', method: 'bank', destination: { label: 'My bank', details: 'AE07 0331 2345 6789 0123 456' } });
    assert.ok([200, 201].includes(w1.status), JSON.stringify(w1.data));
    const tooMuch = await client.json('POST', '/me/payments/withdraw', { accountId: liveAccountId, amount: '450', method: 'bank', destination: { label: 'My bank', details: 'AE07 0331 2345 6789 0123 456' } });
    assert.equal(tooMuch.status, 422);
    assert.equal(tooMuch.data.details.available, '400.00');

    const cancelled = await client.json('POST', `/me/payments/${w1.data.id}/cancel`);
    assert.equal(cancelled.data.status, 'cancelled');
    assert.equal((await client.json('POST', `/me/payments/${w1.data.id}/cancel`)).status, 409);
    assert.equal((await other.json('POST', `/me/payments/${w1.data.id}/cancel`)).status, 404);

    const w2 = await client.json('POST', '/me/payments/withdraw', { accountId: liveAccountId, amount: '100', method: 'crypto_usdt', destination: { label: 'USDT TRC20', details: 'TXYZabc123def456ghi789' } });
    assert.ok([200, 201].includes(w2.status));
    const approved = await admin.json('PATCH', `/admin/payments/${w2.data.id}`, { status: 'approved' });
    assert.equal(approved.status, 200, JSON.stringify(approved.data));
    assert.equal((await client.json('GET', `/me/accounts/${liveAccountId}`)).data.balance, '400.00');

    const w3 = await client.json('POST', '/me/payments/withdraw', { accountId: liveAccountId, amount: '50', method: 'bank', destination: { label: 'My bank', details: 'AE07 0331 2345 6789 0123 456' } });
    assert.equal((await admin.json('PATCH', `/admin/payments/${w3.data.id}`, { status: 'declined' })).status, 400, 'decline needs a note');
    const declined = await admin.json('PATCH', `/admin/payments/${w3.data.id}`, { status: 'declined', note: 'Bank details incomplete' });
    assert.equal(declined.data.status, 'declined');
    assert.equal(declined.data.adminNote, 'Bank details incomplete');
    assert.equal((await client.json('GET', `/me/accounts/${liveAccountId}`)).data.balance, '400.00');

    const history = await client.json('GET', '/me/payments?kind=withdraw');
    assert.equal(history.data.total, 3);
    assert.deepEqual(history.data.items.map((p: any) => p.status).sort(), ['approved', 'cancelled', 'declined']);
  });

  it('an approval that would overdraw is refused and leaves the request pending', async () => {
    const w = await client.json('POST', '/me/payments/withdraw', { accountId: liveAccountId, amount: '400', method: 'bank', destination: { label: 'My bank', details: 'AE07 0331 2345 6789 0123 456' } });
    assert.ok([200, 201].includes(w.status));
    // debit the account behind the request's back, as an admin correction would
    const debit = await admin.json('POST', `/admin/accounts/${liveAccountId}/debit`, { amount: '50', reason: 'E2E correction' });
    assert.ok([200, 201].includes(debit.status), JSON.stringify(debit.data));
    const approve = await admin.json('PATCH', `/admin/payments/${w.data.id}`, { status: 'approved' });
    assert.equal(approve.status, 422);
    assert.equal(approve.data.code, 'insufficient_balance');
    const still = await admin.json('GET', `/admin/payments?status=pending&userId=${clientId}`);
    assert.equal(still.data.items[0].id, w.data.id, 'request stays pending');
    assert.equal((await client.json('GET', `/me/accounts/${liveAccountId}`)).data.balance, '350.00');
    await admin.json('PATCH', `/admin/payments/${w.data.id}`, { status: 'declined', note: 'Balance changed' });
  });

  // ---------------------------------------------------------------- tickets
  it('support tickets round-trip between client and staff', async () => {
    assert.equal((await client.json('POST', '/me/tickets', { subject: 'Hi', message: 'short' })).status, 400);
    const t = await client.json('POST', '/me/tickets', { subject: 'Withdrawal question', message: 'How long does a bank withdrawal take to arrive?' });
    assert.ok([200, 201].includes(t.status), JSON.stringify(t.data));
    assert.equal(t.data.status, 'open');
    assert.equal(t.data.messages.length, 1);
    assert.equal((await client.json('GET', '/me/tickets')).data.length, 1);
    assert.equal((await other.json('GET', `/me/tickets/${t.data.id}`)).status, 404);

    const inbox = await admin.json('GET', '/admin/tickets?status=open');
    assert.ok(inbox.data.items.some((x: any) => x.id === t.data.id && x.user.id === clientId));
    const reply = await admin.json('POST', `/admin/tickets/${t.data.id}/messages`, { body: 'Bank transfers usually arrive in 2-5 business days.' });
    assert.ok([200, 201].includes(reply.status));
    assert.equal(reply.data.status, 'answered');
    assert.equal(reply.data.messages[1].isStaff, true);

    const mine = await client.json('GET', `/me/tickets/${t.data.id}`);
    assert.equal(mine.data.messages.length, 2);
    const again = await client.json('POST', `/me/tickets/${t.data.id}/messages`, { body: 'Thanks!' });
    assert.equal(again.data.status, 'open');
    const closed = await client.json('POST', `/me/tickets/${t.data.id}/close`);
    assert.equal(closed.data.status, 'closed');
    assert.equal((await client.json('POST', `/me/tickets/${t.data.id}/messages`, { body: 'one more' })).status, 409);
    const reopened = await admin.json('PATCH', `/admin/tickets/${t.data.id}`, { status: 'open' });
    assert.equal(reopened.data.status, 'open');
  });

  it('dashboard counters reflect the queues', async () => {
    const d = await admin.json('GET', '/admin/dashboard');
    assert.equal(typeof d.data.pendingKyc, 'number');
    assert.equal(typeof d.data.pendingPayments, 'number');
  });

  after(async () => {
    await client.raw('POST', '/auth/logout');
    await other.raw('POST', '/auth/logout');
    await admin.raw('POST', '/auth/logout');
  });
});

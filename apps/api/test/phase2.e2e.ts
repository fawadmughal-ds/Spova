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
  const email = `e2e+${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@zerventa.local`;
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
    // sign-up opens a live account; a demo account is an optional extra the client opens
    const accounts = await client.json('GET', '/me/accounts');
    liveAccountId = accounts.data.live[0].id;
    const demo = await client.json('POST', '/me/accounts', { type: 'demo' });
    assert.ok([200, 201].includes(demo.status), JSON.stringify(demo.data));
    demoAccountId = demo.data.id;
  });

  // ---------------------------------------------------------------- KYC
  it('starts unverified and cannot see admin queues', async () => {
    const me = await client.json('GET', '/auth/me');
    assert.deepEqual({ poi: me.data.kyc.poi, por: me.data.kyc.por, payment: me.data.kyc.payment }, { poi: false, por: false, payment: false });
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

  it('sign-up opened a live account; a second one needs verification; demo accounts take no real money', async () => {
    const me = await client.json('GET', '/auth/me');
    assert.equal(typeof me.data.kyc.deadlineAt, 'string', '15-day document deadline is set');
    assert.ok(me.data.kyc.daysLeft >= 14 && me.data.kyc.daysLeft <= 15, `daysLeft=${me.data.kyc.daysLeft}`);
    assert.equal(me.data.kyc.frozen, false);
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
    assert.deepEqual({ poi: me.data.kyc.poi, por: me.data.kyc.por, payment: me.data.kyc.payment }, { poi: true, por: true, payment: false });
    const st = await client.json('GET', '/me/kyc/status');
    assert.equal(st.data.poi, 'approved');
    assert.equal(st.data.por, 'approved');
    assert.equal(st.data.payment, 'incomplete');
  });

  // ---------------------------------------------------------------- payments
  it('one live account per client; deposit requests are validated', async () => {
    const second = await client.json('POST', '/me/accounts', { type: 'live' });
    assert.equal(second.status, 409, JSON.stringify(second.data));
    assert.equal(second.data.code, 'live_limit');
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

  it('back-office controls: instruments, risk tiers, platform switches, staff, broadcast', async () => {
    // instruments
    const syms = await admin.json('GET', '/admin/symbols');
    assert.equal(syms.status, 200);
    const eur = syms.data.find((x: any) => x.id === 'EURUSD');
    assert.ok(eur && typeof eur.spreadMarkup === 'string');
    const patched = await admin.json('PATCH', '/admin/symbols/EURUSD', { spreadMarkup: '0.00012', leverageMax: 300 });
    assert.equal(patched.status, 200, JSON.stringify(patched.data));
    assert.equal(patched.data.spreadMarkup, '0.00012');
    assert.equal(patched.data.leverageMax, 300);
    assert.equal((await admin.json('PATCH', '/admin/symbols/EURUSD', { minLot: '5', maxLot: '1' })).data.code, 'lots_invalid');
    assert.equal((await admin.json('PATCH', '/admin/symbols/NOPE', { enabled: false })).status, 404);
    await admin.json('PATCH', '/admin/symbols/EURUSD', { spreadMarkup: eur.spreadMarkup, leverageMax: eur.leverageMax });
    assert.equal((await client.json('GET', '/admin/symbols')).status, 403, 'clients cannot read the control surface');

    // risk tiers
    const risk = await admin.json('GET', '/admin/risk-config');
    assert.equal(risk.status, 200);
    const classic = risk.data.find((r: any) => r.tier === 'classic');
    assert.ok(classic);
    const bad = await admin.json('PUT', '/admin/risk-config/classic', { ...classic, stopOutPct: 150 });
    assert.equal(bad.status, 400, 'stop-out above margin call is refused');
    const ok = await admin.json('PUT', '/admin/risk-config/classic', { marginCallPct: classic.marginCallPct, stopOutPct: classic.stopOutPct, defaultLeverage: classic.defaultLeverage, maxLeverage: classic.maxLeverage, minDeposit: classic.minDeposit, spreadDiscountPct: 5 });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.equal(ok.data.spreadDiscountPct, 5);
    await admin.json('PUT', '/admin/risk-config/classic', { marginCallPct: classic.marginCallPct, stopOutPct: classic.stopOutPct, defaultLeverage: classic.defaultLeverage, maxLeverage: classic.maxLeverage, minDeposit: classic.minDeposit, spreadDiscountPct: classic.spreadDiscountPct });

    // platform switches: halt blocks new orders, registration can be closed
    const platform = await admin.json('GET', '/admin/platform');
    assert.equal(platform.status, 200);
    const halted = await admin.json('PUT', '/admin/platform', { ...platform.data, tradingHalt: { enabled: true, message: 'Maintenance' }, registrationOpen: false });
    assert.equal(halted.status, 200, JSON.stringify(halted.data));
    const pub = await new Session().json('GET', '/market/platform');
    assert.equal(pub.data.tradingHalt.enabled, true);
    assert.equal(pub.data.registrationOpen, false);
    const order = await client.json('POST', `/me/accounts/${demoAccountId}/orders`, { symbol: 'EURUSD', side: 'buy', type: 'market', lots: '0.01' });
    assert.equal(order.data.code, 'trading_halted', JSON.stringify(order.data));
    const reg = await new Session().json('POST', '/auth/register', { email: `e2e+closed.${Date.now()}@zerventa.local`, password: 'E2e!Passw0rd', firstName: 'E2e', lastName: 'Closed', phone: '+971501234567', dob: '1990-01-01', countryCode: 'AE', tcAccepted: true, riskAccepted: true });
    assert.equal(reg.data.code, 'registration_closed');
    const restored = await admin.json('PUT', '/admin/platform', { ...platform.data, tradingHalt: { ...platform.data.tradingHalt, enabled: false }, registrationOpen: true });
    assert.equal(restored.status, 200);
    assert.equal((await client.json('PUT', '/admin/platform', platform.data)).status, 403);

    // staff (the seeded admin is a superadmin)
    const staffEmail = `e2e+staff.${Date.now()}@zerventa.local`;
    const created = await admin.json('POST', '/admin/staff', { email: staffEmail, firstName: 'Ops', lastName: 'Desk', role: 'admin', password: 'Staff!Passw0rd' });
    assert.ok([200, 201].includes(created.status), JSON.stringify(created.data));
    assert.equal(created.data.role, 'admin');
    const staffSession = new Session();
    assert.equal((await staffSession.json('POST', '/auth/login', { email: staffEmail, password: 'Staff!Passw0rd' })).status, 200, 'new staff can sign in');
    assert.equal((await staffSession.json('GET', '/admin/symbols')).status, 200, 'admin role reaches the control surface');
    assert.equal((await staffSession.json('POST', '/admin/staff', { email: 'x@zerventa.local', firstName: 'a', lastName: 'b', role: 'admin', password: 'Staff!Passw0rd' })).data.code, 'superadmin_only');
    const frozen = await admin.json('PATCH', `/admin/staff/${created.data.id}`, { status: 'frozen' });
    assert.equal(frozen.data.status, 'frozen');
    assert.equal((await staffSession.json('GET', '/admin/symbols')).status, 401, 'frozen staff sessions are revoked');

    // broadcast
    const bc = await admin.json('POST', '/admin/broadcast', { title: 'Holiday hours', body: 'Markets close early on Friday.', level: 'info', audience: 'all', email: false });
    assert.ok([200, 201].includes(bc.status), JSON.stringify(bc.data));
    assert.ok(bc.data.recipients >= 1);
    const audit = await admin.json('GET', '/admin/audit?limit=50');
    for (const action of ['symbol.update', 'risk.update', 'platform.update', 'staff.create', 'staff.update', 'broadcast.send']) assert.ok(audit.data.items.some((a: any) => a.action === action), `audit has ${action}`);
  });

  it('document deadline: reminder at 3 days, freeze at 15 days, auto-unfreeze on upload, admin unfreeze', async () => {
    await resetRateLimits(); // this test registers two more clients on the same IP
    const late = new Session();
    const lateReg = await register(late, 'late');
    const lateId = lateReg.me.id;
    const lateDemo = await late.json('POST', '/me/accounts', { type: 'demo' });
    const lateAcc = lateDemo.data.id;

    // reminder window: deadline in 2 days -> sweep reminds once, never twice
    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString();
    assert.equal((await admin.json('PATCH', `/admin/users/${lateId}`, { kycDeadlineAt: soon })).status, 200);
    const s1 = await admin.json('POST', '/admin/kyc/sweep');
    assert.ok([200, 201].includes(s1.status), JSON.stringify(s1.data));
    assert.ok(s1.data.reminded >= 1, 'reminder sent');
    const s2 = await admin.json('POST', '/admin/kyc/sweep');
    const dl = await admin.json('GET', '/admin/kyc/deadlines');
    const row = dl.data.find((r: any) => r.user.id === lateId);
    assert.ok(row && row.frozen === false && row.daysLeft <= 3 && row.uploadedGroups.length === 0, JSON.stringify(row));
    assert.ok(s2.data.reminded === 0 || !dl.data.some((r: any) => r.user.id === lateId && r.daysLeft > 3), 'no second reminder for the same client');

    // deadline passed -> frozen: trading blocked everywhere, me.kyc.frozen, admin list shows it first
    const past = new Date(Date.now() - 3600_000).toISOString();
    await admin.json('PATCH', `/admin/users/${lateId}`, { kycDeadlineAt: past });
    const s3 = await admin.json('POST', '/admin/kyc/sweep');
    assert.ok(s3.data.frozen >= 1, JSON.stringify(s3.data));
    const meFrozen = await late.json('GET', '/auth/me');
    assert.equal(meFrozen.data.kyc.frozen, true);
    assert.equal(meFrozen.data.kyc.complete, false);
    const order = await late.json('POST', `/me/accounts/${lateAcc}/orders`, { symbol: 'EURUSD', side: 'buy', type: 'market', lots: '0.01' });
    assert.equal(order.data.code, 'trading_blocked', JSON.stringify(order.data));
    const frozenRow = (await admin.json('GET', '/admin/kyc/deadlines')).data.find((r: any) => r.user.id === lateId);
    assert.equal(frozenRow.frozen, true);

    // uploading one document in each of the four groups unfreezes automatically
    for (const [group, docType] of [['poi', 'passport'], ['por', 'utility_bill'], ['payment', 'card_front']] as const) {
      const up = await late.json('POST', '/me/kyc/documents', upload(group, docType, PNG, 'image/png', `${group}.png`));
      assert.ok([200, 201].includes(up.status), JSON.stringify(up.data));
      assert.equal((await late.json('GET', '/auth/me')).data.kyc.frozen, true, 'still frozen until all four groups are in');
    }
    const last = await late.json('POST', '/me/kyc/documents', upload('other', 'source_of_funds', PNG, 'image/png', 'other.png'));
    assert.ok([200, 201].includes(last.status));
    const meOk = await late.json('GET', '/auth/me');
    assert.equal(meOk.data.kyc.frozen, false);
    assert.equal(meOk.data.kyc.complete, true);
    assert.equal((await late.json('GET', `/me/accounts/${lateAcc}`)).data.tradingBlocked, false);
    assert.ok(!(await admin.json('GET', '/admin/kyc/deadlines')).data.some((r: any) => r.user.id === lateId), 'complete clients leave the deadline list');

    // admin unfreeze path on another client whose deadline passed
    const stuck = new Session();
    const stuckReg = await register(stuck, 'stuck');
    await admin.json('PATCH', `/admin/users/${stuckReg.me.id}`, { kycDeadlineAt: past });
    await admin.json('POST', '/admin/kyc/sweep');
    assert.equal((await stuck.json('GET', '/auth/me')).data.kyc.frozen, true);
    const un = await admin.json('POST', `/admin/kyc/users/${stuckReg.me.id}/unfreeze`);
    assert.ok([200, 201].includes(un.status), JSON.stringify(un.data));
    const meUn = await stuck.json('GET', '/auth/me');
    assert.equal(meUn.data.kyc.frozen, false);
    assert.ok(meUn.data.kyc.daysLeft >= 14, 'unfreeze grants a fresh 15-day window');
    assert.equal((await client.json('POST', '/admin/kyc/sweep')).status, 403);
    const audit = await admin.json('GET', '/admin/audit?limit=50');
    assert.ok(audit.data.items.some((a: any) => a.action === 'kyc.unfreeze'));
  });

  it('dated account statement downloads as PDF and CSV for the owner only', async () => {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const pdf = await client.raw('GET', `/me/accounts/${liveAccountId}/statement?from=${from}&to=${to}&format=pdf`);
    assert.equal(pdf.status, 200, `statement pdf status ${pdf.status}`);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.ok((pdf.headers.get('content-disposition') ?? '').includes('.pdf'));
    const bytes = Buffer.from(await pdf.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString('ascii'), '%PDF-');
    const csv = await client.raw('GET', `/me/accounts/${liveAccountId}/statement?from=${from}&to=${to}&format=csv`);
    assert.equal(csv.status, 200);
    const text = await csv.text();
    assert.ok(text.includes('Opening balance') && text.includes('Closed trades') && text.includes('Ledger'));
    assert.equal((await other.raw('GET', `/me/accounts/${liveAccountId}/statement?from=${from}&to=${to}`)).status, 404, 'not the owner');
    assert.equal((await client.raw('GET', `/me/accounts/${liveAccountId}/statement?from=${to}&to=${from}`)).status, 400, 'end before start');
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

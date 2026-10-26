/**
 * Admin account ops + dashboard KPIs: admin opens/archives accounts for a client, sets a per-account
 * USD rate, the demo self-serve limit is 5, and the dashboard exposes all-time deposit/withdraw/manual totals.
 */
import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Session, adminLogin, created, register } from './http';

describe('admin account ops + dashboard KPIs', () => {
  const client = new Session();
  const admin = new Session();
  let clientId = '';

  before(async () => {
    const a = await register(client, 'adminops');
    clientId = a.me.id;
    await adminLogin(admin);
  });

  it('admin opens a demo account for the client', async () => {
    const before = await admin.json('GET', `/admin/users/${clientId}`);
    const demoBefore = before.data.accounts.filter((x: { type: string }) => x.type === 'demo').length;
    const r = await admin.json('POST', `/admin/users/${clientId}/accounts`, { type: 'demo' });
    assert.ok(created(r.status), JSON.stringify(r.data));
    assert.equal(r.data.type, 'demo');
    const after = await admin.json('GET', `/admin/users/${clientId}`);
    assert.equal(after.data.accounts.filter((x: { type: string }) => x.type === 'demo').length, demoBefore + 1);
  });

  it('admin sets and clears a per-account USD rate', async () => {
    const d = await admin.json('GET', `/admin/users/${clientId}`);
    const acc = d.data.accounts[0];
    const set = await admin.json('PATCH', `/admin/accounts/${acc.id}`, { usdRate: 86.5 });
    assert.ok(created(set.status), JSON.stringify(set.data));
    assert.equal(Number(set.data.usdRate), 86.5);
    const clear = await admin.json('PATCH', `/admin/accounts/${acc.id}`, { usdRate: null });
    assert.equal(clear.data.usdRate, null);
  });

  it('admin can archive (disable) an account, keeping its history', async () => {
    const d = await admin.json('GET', `/admin/users/${clientId}`);
    const demo = d.data.accounts.find((x: { type: string }) => x.type === 'demo');
    const r = await admin.json('PATCH', `/admin/accounts/${demo.id}`, { status: 'disabled' });
    assert.ok(created(r.status), JSON.stringify(r.data));
    assert.equal(r.data.status, 'disabled');
    // still present (archived, not deleted)
    const after = await admin.json('GET', `/admin/users/${clientId}`);
    assert.ok(after.data.accounts.some((x: { id: string }) => x.id === demo.id));
  });

  it('the demo self-serve limit is 5', async () => {
    // sign-up opens a live account (no demo); keep opening demos until the server rejects at the limit
    let lastCode = 0;
    for (let i = 0; i < 8; i++) {
      const r = await client.json('POST', '/me/accounts', { type: 'demo' });
      lastCode = r.status;
      if (r.status === 409) {
        assert.equal(r.data.code, 'demo_limit');
        break;
      }
    }
    assert.equal(lastCode, 409, 'should eventually hit the demo limit (5)');
  });

  it('dashboard exposes all-time deposit / withdraw / manual-credit totals', async () => {
    const d = await admin.json('GET', '/admin/dashboard');
    assert.ok(created(d.status), JSON.stringify(d.data));
    for (const k of ['depositsTotal', 'withdrawalsTotal', 'manualCreditsTotal']) {
      assert.equal(typeof d.data[k], 'string', `${k} present`);
    }
  });

  it('per-client stats include manual credits', async () => {
    const d = await admin.json('GET', `/admin/users/${clientId}`);
    assert.equal(typeof d.data.stats.manualCredits, 'string');
  });

  it('a manual deposit (admin, no client request) shows in the dashboard deposit totals', async () => {
    const acc = await admin.json('POST', `/admin/users/${clientId}/accounts`, { type: 'live' });
    assert.ok(created(acc.status), JSON.stringify(acc.data));
    const before = await admin.json('GET', '/admin/dashboard');
    const dep0 = Number(before.data.depositsTotal);
    const r = await admin.json('POST', `/admin/accounts/${acc.data.id}/credit`, { amount: '500', reason: 'Manual bank deposit', type: 'deposit' });
    assert.ok(created(r.status), JSON.stringify(r.data));
    const after = await admin.json('GET', '/admin/dashboard');
    assert.equal(Number(after.data.depositsTotal), dep0 + 500, 'manual deposit counted in dashboard deposits');
    // and in the client's own deposit figure
    const d = await admin.json('GET', `/admin/users/${clientId}`);
    assert.ok(Number(d.data.stats.depositsApproved) >= 500);
  });

  it('admin can delete an account (hard delete)', async () => {
    const acc = await admin.json('POST', `/admin/users/${clientId}/accounts`, { type: 'demo' });
    const id = acc.data.id;
    const d = await admin.json('DELETE', `/admin/accounts/${id}`);
    assert.ok(created(d.status), JSON.stringify(d.data));
    const after = await admin.json('GET', `/admin/users/${clientId}`);
    assert.ok(!after.data.accounts.some((x: { id: string }) => x.id === id), 'deleted account is gone');
  });

  it('closed-positions query returns only closed (open=false is not coerced to true)', async () => {
    const r = await admin.json('GET', '/admin/positions?open=false&limit=50');
    assert.ok(created(r.status), JSON.stringify(r.data));
    assert.ok(r.data.items.every((p: { status: string }) => p.status === 'closed'), 'all items are closed');
  });

  it('admin money moves are recorded in the per-client activity feed and are searchable', async () => {
    const acc = await admin.json('POST', `/admin/users/${clientId}/accounts`, { type: 'live' });
    await admin.json('POST', `/admin/accounts/${acc.data.id}/credit`, { amount: '123', reason: 'ActivityProbe deposit', type: 'deposit' });
    const feed = await admin.json('GET', `/admin/activity?userId=${clientId}&kind=deposit`);
    assert.ok(created(feed.status), JSON.stringify(feed.data));
    assert.ok(feed.data.items.length >= 1, 'manual deposit shows in the client activity feed');
    const search = await admin.json('GET', `/admin/activity?userId=${clientId}&q=ActivityProbe`);
    assert.ok(search.data.items.length >= 1, 'search finds the event');
    // the client's own actions are there too (sign-up)
    const reg = await admin.json('GET', `/admin/activity?userId=${clientId}&kind=register`);
    assert.ok(reg.data.items.length >= 1, 'sign-up is in the timeline');
  });

  it('payments summary returns deposit/withdraw totals and respects the date range', async () => {
    const s = await admin.json('GET', '/admin/payments/summary');
    assert.ok(created(s.status), JSON.stringify(s.data));
    assert.equal(typeof s.data.deposits.count, 'number');
    assert.equal(typeof s.data.withdrawals.approved, 'string');
    assert.equal(typeof s.data.pending, 'number');
    const ranged = await admin.json('GET', '/admin/payments/summary?from=2020-01-01&to=2020-01-02');
    assert.equal(ranged.data.deposits.count, 0, 'an old date range has no deposits');
    const list = await admin.json('GET', '/admin/payments?from=2020-01-01&to=2020-01-02');
    assert.ok(created(list.status), JSON.stringify(list.data));
    assert.equal(list.data.items.length, 0, 'old date range list is empty');
  });

  it('trading-accounts list returns rows with name + balance/equity/margin and filters by type/tier/search', async () => {
    const all = await admin.json('GET', '/admin/accounts');
    assert.ok(created(all.status), JSON.stringify(all.data));
    assert.ok(Array.isArray(all.data.items) && typeof all.data.total === 'number');
    const row = all.data.items[0];
    for (const k of ['userId', 'userEmail', 'loginCode', 'type', 'tier', 'balance', 'equity', 'marginLevel']) {
      assert.ok(k in row, `row has ${k}`);
    }
    assert.ok('firstName' in row, 'row has client name');
    const demo = await admin.json('GET', '/admin/accounts?type=demo');
    assert.ok(demo.data.items.every((a: { type: string }) => a.type === 'demo'), 'type filter works');
    const classic = await admin.json('GET', '/admin/accounts?tier=classic');
    assert.ok(classic.data.items.every((a: { tier: string }) => a.tier === 'classic'), 'tier filter works');
    const mine = await admin.json('GET', `/admin/accounts?userId=${clientId}`);
    assert.ok(mine.data.items.every((a: { userId: string }) => a.userId === clientId), 'userId filter works');
  });

  it('remove_credit debits the credit bucket, not the cash balance', async () => {
    const d = await admin.json('GET', `/admin/users/${clientId}`);
    const acc = d.data.accounts[0];
    const bal0 = Number(acc.balance);
    const add = await admin.json('POST', `/admin/accounts/${acc.id}/credit`, { amount: '100', reason: 'Promo bonus', type: 'bonus' });
    assert.ok(created(add.status), JSON.stringify(add.data));
    const cred1 = Number(add.data.account.credit);
    const rm = await admin.json('POST', `/admin/accounts/${acc.id}/debit`, { amount: '60', reason: 'Clawback unused bonus', type: 'remove_credit' });
    assert.ok(created(rm.status), JSON.stringify(rm.data));
    assert.equal(Number(rm.data.account.credit), cred1 - 60, 'credit reduced by 60');
    assert.equal(Number(rm.data.account.balance), bal0, 'cash balance unchanged');
  });
});

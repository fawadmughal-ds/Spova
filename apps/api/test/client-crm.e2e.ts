/**
 * Client CRM: sign-up captures the residential address + suitability questionnaire and the admin can
 * read them back; agents keep a timestamped comment log on the client's file (add / edit / delete),
 * plus the single "about this client" note. Invalid sign-up input is refused.
 */
import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Session, adminLogin, created, register } from './http';

describe('client CRM: suitability, address, notes & call log', () => {
  const client = new Session();
  const admin = new Session();
  let clientId = '';

  before(async () => {
    const a = await register(client, 'crm');
    clientId = a.me.id;
    await adminLogin(admin);
  });

  it('stores the address + suitability answers from sign-up and shows them to the admin', async () => {
    const d = await admin.json('GET', `/admin/users/${clientId}`);
    assert.ok(created(d.status), JSON.stringify(d.data));
    assert.equal(d.data.profile.address, '12 Marina Walk');
    assert.equal(d.data.profile.city, 'Dubai');
    assert.equal(d.data.profile.sourceOfFunds, 'salary');
    assert.equal(d.data.profile.netWorth, '50k_250k');
    assert.equal(d.data.profile.tradingExperience, '1_3y');
    assert.deepEqual(d.data.comments, []);
  });

  it('refuses onboarding without a residential address', async () => {
    const s = new Session();
    const reg = await s.json('POST', '/auth/register', {
      email: `crm.bad.${Date.now()}@zerventa.local`,
      password: 'E2e!Passw0rd',
      firstName: 'No',
      lastName: 'Address',
      phone: '+971501234567',
      tcAccepted: true,
      riskAccepted: true,
    });
    assert.ok(created(reg.status), JSON.stringify(reg.data));
    const r = await s.json('POST', '/me/onboarding', {
      dob: '1990-01-01',
      countryCode: 'AE',
      city: 'Dubai',
      sourceOfFunds: 'salary',
      employmentStatus: 'employed',
      annualIncome: '50k_100k',
      netWorth: '50k_250k',
      expectedDeposit: '1k_5k',
      jobRole: 'finance',
      usCitizen: 'no',
      pep: 'no',
      tradingExperience: '1_3y',
      tradingObjective: 'speculation',
      // address intentionally omitted
    });
    assert.equal(r.status, 400);
  });

  it('adds, edits and deletes comments on the client file (persisted)', async () => {
    const add = await admin.json('POST', `/admin/users/${clientId}/notes`, { body: 'Client said call 5 minutes later' });
    assert.ok(created(add.status), JSON.stringify(add.data));
    assert.equal(add.data.body, 'Client said call 5 minutes later');
    assert.ok(add.data.authorName && add.data.authorName !== 'staff', 'comment carries the author name');
    const id = add.data.id;

    // persisted: a fresh read returns it
    const list = await admin.json('GET', `/admin/users/${clientId}/notes`);
    assert.ok(list.data.some((c: { id: string }) => c.id === id));

    const edit = await admin.json('PATCH', `/admin/notes/${id}`, { body: 'Called back — interested in gold' });
    assert.ok(created(edit.status), JSON.stringify(edit.data));
    assert.equal(edit.data.body, 'Called back — interested in gold');

    const delr = await admin.json('DELETE', `/admin/notes/${id}`);
    assert.ok(created(delr.status), JSON.stringify(delr.data));
    const after = await admin.json('GET', `/admin/users/${clientId}/notes`);
    assert.ok(!after.data.some((c: { id: string }) => c.id === id), 'deleted comment is gone');
  });

  it('empty comment body is rejected', async () => {
    const r = await admin.json('POST', `/admin/users/${clientId}/notes`, { body: '   ' });
    assert.equal(r.status, 400);
  });

  it('saves the single "about this client" note', async () => {
    const r = await admin.json('PATCH', `/admin/users/${clientId}`, { notes: 'Works as a doctor; prefers evening calls.' });
    assert.ok(created(r.status), JSON.stringify(r.data));
    const d = await admin.json('GET', `/admin/users/${clientId}`);
    assert.equal(d.data.notes, 'Works as a doctor; prefers evening calls.');
  });
});

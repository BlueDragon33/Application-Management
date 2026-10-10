import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const batch = '11111111-1111-4111-8111-111111111111';
const deviceId = 'test-device-11111111111111111111';
const applicant = { surname: 'Nguyễn', givenNames: 'Test', birthDate: '01/01/1990', birthPlace: 'Hà Nội',
  sex: 'МУЖСКОЙ', passportNo: 'TEST0001', passportIssue: '01/01/2020', passportExpiry: '01/01/2030',
  phone: '0000000000', email: 'TEST@example.com', hasPermanentAddress: false, worksOrStudies: false };

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  for (const path of ['drizzle/0009_visa_intake.sql', 'drizzle/0010_visa_intake_results.sql', 'drizzle/0011_visa_intake_device_recovery.sql']) sqlite.exec(fs.readFileSync(path, 'utf8'));
  sqlite.prepare('INSERT INTO visa_intake_links(id,token_hash,created_by) VALUES (?,?,?)').run(batch, 'test-only-hash', 'test@example.com');
  let barrier = null;
  const errors = [];
  const database = {
    prepare(query) {
      let args = [];
      const statement = {
        bind(...values) { args = values; return statement; },
        async first() {
          let result;
          try { result = sqlite.prepare(query).get(...args) ?? null; }
          catch (error) { errors.push(error.message); throw error; }
          if (barrier && query.includes(barrier.match)) await barrier.wait();
          return result;
        },
        async run() { return { meta: { changes: Number(sqlite.prepare(query).run(...args).changes) } }; },
      };
      return statement;
    },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('app/api/kd-mid-visa-intake/public/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'exports', code)(() => ({ getControlDatabase: async () => database }), exports);
  const post = (body = {}) => exports.POST(new Request('https://intake.test/api/kd-mid-visa-intake/public', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ batch, deviceId, applicant, confirmedAccurate: true, ...body }),
  }));
  const get = (id = '', device = deviceId) => exports.GET(new Request('https://intake.test/api/kd-mid-visa-intake/public?batch=' + batch + '&deviceId=' + device + (id ? '&submissionId=' + id : '')));
  const race = match => {
    let release; let count = 0;
    const wait = new Promise(resolve => { release = resolve; });
    barrier = { match, async wait() { if (++count === 2) { barrier = null; release(); } await wait; } };
  };
  return { sqlite, post, get, race, errors };
}

test('public POST normalizes data and independently reads it back from local SQLite', async t => {
  const f = fixture(t);
  const response = await f.post();
  assert.equal(response.status, 201, f.errors.join('; '));
  const sent = await response.json();
  const read = await (await f.get(sent.submission.id)).json();
  assert.equal(read.submission.applicant.surname, 'NGUYEN');
  assert.equal(read.submission.applicant.birthPlace, 'HA NOI');
  assert.equal(read.submission.applicant.email, 'test@example.com');
  assert.equal(read.submission.queueNo, sent.submission.queueNo);
  assert.equal((await f.get(sent.submission.id, 'other-device-11111111111111111')).status, 403);
});

test('concurrent first submits create exactly one durable record and one receipt identity', async t => {
  const f = fixture(t);
  f.race('WHERE link_id=? AND device_hash=? ORDER BY queue_no DESC');
  const responses = await Promise.all([f.post(), f.post()]);
  const bodies = await Promise.all(responses.map(r => r.json()));
  assert.ok(responses.every(r => r.ok));
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM visa_intake_submissions').get().n, 1);
  assert.equal(bodies[0].submission.id, bodies[1].submission.id);
  assert.equal(bodies[0].submission.queueNo, bodies[1].submission.queueNo);
});

test('concurrent rejected resubmits change the revision exactly once', async t => {
  const f = fixture(t);
  const initial = await (await f.post()).json();
  f.sqlite.prepare("UPDATE visa_intake_submissions SET status='rejected',validation_json=? WHERE id=?").run(
    JSON.stringify({ revision: 0, correctionFields: ['birthPlace'] }), initial.submission.id);
  f.race('validation_json,device_hash FROM visa_intake_submissions WHERE id=');
  const responses = await Promise.all([f.post({ submissionId: initial.submission.id, expectedRevision: 0 }), f.post({ submissionId: initial.submission.id, expectedRevision: 0 })]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const read = await (await f.get(initial.submission.id)).json();
  assert.equal(read.submission.revision, 1);
  assert.equal(read.submission.queueNo, initial.submission.queueNo);
  assert.deepEqual(read.submission.resubmittedFields, ['birthPlace']);
});

test('server preserves deliberately cleared optional defaults in POST and readback', async t => {
  const f = fixture(t);
  f.sqlite.prepare('UPDATE visa_intake_links SET defaults_json=?').run(JSON.stringify({ invitation: 'OLD-INVITATION' }));
  const response = await f.post({ applicant: { ...applicant, invitation: '' } });
  assert.equal(response.status, 201);
  const sent = await response.json();
  assert.equal(sent.submission.applicant.invitation, '');
  const read = await (await f.get(sent.submission.id)).json();
  assert.equal(read.submission.applicant.invitation, '');
});

test('server rejects an explicitly cleared required Telex instead of silently substituting it', async t => {
  const f = fixture(t);
  const response = await f.post({ applicant: { ...applicant, telex: '' } });
  assert.equal(response.status, 400);
  assert.ok((await response.json()).missing.includes('Mã Telex'));
});

test('stale rejected tab cannot revert a newer corrected revision', async t => {
  const f = fixture(t);
  const initial = await (await f.post()).json();
  const id = initial.submission.id;
  f.sqlite.prepare("UPDATE visa_intake_submissions SET status='rejected',validation_json=? WHERE id=?").run(JSON.stringify({ revision: 0, correctionFields: ['birthPlace'] }), id);
  assert.equal((await f.post({ submissionId: id, expectedRevision: 0, applicant: { ...applicant, birthPlace: 'Da Nang' } })).status, 200);
  f.sqlite.prepare("UPDATE visa_intake_submissions SET status='rejected',validation_json=? WHERE id=?").run(JSON.stringify({ revision: 1, correctionFields: ['phone'] }), id);
  assert.equal((await f.post({ submissionId: id, expectedRevision: 0 })).status, 409);
  assert.equal((await f.post({ submissionId: id })).status, 409);
  const read = await (await f.get(id)).json();
  assert.equal(read.submission.applicant.birthPlace, 'DA NANG');
  assert.equal(read.submission.revision, 1);
  assert.equal(read.submission.queueNo, initial.submission.queueNo);
});

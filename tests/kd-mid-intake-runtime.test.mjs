import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';
import ts from 'typescript';

// Execute the complete emitted Worker page. Only the network/storage boundary
// uses fixtures; these tests do not assert real Preview/server acceptance.
const source = fs.readFileSync('worker/visa-intake-public.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { publicVisaIntakePage } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const batch = '11111111-1111-4111-8111-111111111111';
const draftKey = 'visa-intake:draft:batch:' + batch;
const applicant = {
  surname: 'NGUYEN', givenNames: 'TEST', birthPlace: 'HA NOI', birthDate: '01/01/1990',
  sex: 'МУЖСКОЙ', passportNo: 'TEST0001', passportIssue: '01/01/2020', passportExpiry: '01/01/2030',
  hasOtherNames: false, otherNames: '', hasPermanentAddress: false, worksOrStudies: false,
  email: 'test@example.com', phone: '0000000000', entryDate: '01/12/2026', exitDate: '31/12/2026',
};
const linkData = { ok: true, link: { label: 'TEST ONLY', formType: 'student' }, defaults: {} };
const flush = () => new Promise(resolve => setImmediate(resolve));

async function page(t, { saved, memory = new Map(), denied = false, deferred = false, data = linkData } = {}) {
  if (saved) memory.set(draftKey, JSON.stringify(saved));
  const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  const response = await publicVisaIntakePage(new Request('https://intake.test/visa-intake?batch=' + batch), {
    DB: { prepare: () => ({ bind: () => ({ first: async () => ({ defaults_json: '{}' }) }) }) },
  });
  let resolveInitial;
  const initial = new Promise(resolve => { resolveInitial = resolve; });
  const posts = [];
  let statusData = null;
  const errors = [];
  const timers = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(await response.text(), {
    url: 'https://intake.test/visa-intake?batch=' + batch, runScripts: 'dangerously', virtualConsole: console,
    beforeParse(window) {
      Object.defineProperty(window, 'localStorage', { get: () => { if (denied) throw new Error('storage-denied'); return storage; } });
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.setInterval = (callback, delay) => { timers.push({ callback, delay }); return timers.length; };
      window.fetch = async (_url, options) => {
        if (options?.method === 'POST') return new Promise(resolve => posts.push({ payload: JSON.parse(options.body), resolve }));
        return statusData ? { ok: true, status: 200, json: async () => statusData } : initial;
      };
    },
  });
  t.after(() => dom.window.close());
  const ready = async (body = data) => { resolveInitial({ ok: true, status: 200, json: async () => body }); await flush(); };
  if (!deferred) await ready();
  const field = name => dom.window.document.querySelector('[name="' + name + '"]');
  const dispatch = (element, type, options = {}) => element.dispatchEvent(new dom.window.Event(type, { bubbles: true, ...options }));
  return { dom, window: dom.window, document: dom.window.document, field, dispatch, memory, posts, errors, timers, ready, status: body => { statusData = body; } };
}

test('complete emitted page boots without script errors', async t => {
  const p = await page(t);
  assert.deepEqual(p.errors, []);
  assert.equal(p.document.querySelector('#form').style.display, '');
});

test('composing Vietnamese input stays untouched until compositionend, including autosave', async t => {
  const p = await page(t);
  const input = p.field('surname');
  p.dispatch(input, 'compositionstart');
  input.value = 'Nguyễn';
  input.dispatchEvent(new p.window.InputEvent('input', { bubbles: true, isComposing: true }));
  assert.equal(input.value, 'Nguyễn');
  assert.notEqual(JSON.parse(p.memory.get(draftKey)).applicant.surname, 'NGUYEN');
  p.dispatch(input, 'compositionend');
  assert.equal(input.value, 'NGUYEN');
  assert.equal(JSON.parse(p.memory.get(draftKey)).applicant.surname, 'NGUYEN');
});

test('normalization preserves a caret inside accented input', async t => {
  const p = await page(t);
  const input = p.field('givenNames');
  input.value = 'Đình Nam'; input.setSelectionRange(2, 2);
  p.dispatch(input, 'input');
  assert.equal(input.value, 'DINH NAM');
  assert.equal(input.selectionStart, 2);
});

test('denied localStorage getter reports draft error without hiding the form', async t => {
  const p = await page(t, { denied: true });
  assert.equal(p.document.querySelector('#draftStatus').dataset.state, 'error');
  assert.notEqual(p.document.querySelector('#form').style.display, 'none');
  assert.deepEqual(p.errors, []);
});

test('restore preserves explicit empty edits and refreshes conditional required fields', async t => {
  const p = await page(t, { saved: { applicant: { ...applicant, routeCity: '', hasOtherNames: true }, receipt: null } });
  assert.equal(p.field('routeCity').value, '');
  assert.equal(p.field('otherNames').required, true);
  assert.equal(p.field('workStudyPlace').required, false);
  assert.equal(p.field('personalAddress').required, false);
});

test('reopening same device restores corrected draft before rejected resubmission', async t => {
  const receipt = { id: 'test-submission', status: 'rejected', revision: 0, queueNo: 1, correctionFields: ['birthPlace'] };
  const p = await page(t, { saved: { applicant: { ...applicant, birthPlace: 'DA NANG' }, receipt },
    data: { ...linkData, submission: { ...receipt, applicant: { ...applicant, birthPlace: 'HA NOI' } } } });
  assert.equal(p.field('birthPlace').value, 'DA NANG');
  assert.equal(JSON.parse(p.memory.get(draftKey)).receipt.id, receipt.id);
});

test('input edits survive delayed initialization and another page using the draft', async t => {
  const p = await page(t, { deferred: true });
  p.field('surname').value = 'Nguyễn'; p.dispatch(p.field('surname'), 'input');
  p.field('routeCity').value = ''; p.dispatch(p.field('routeCity'), 'input');
  await p.ready();
  assert.equal(p.field('surname').value, 'NGUYEN');
  assert.equal(p.field('routeCity').value, '');
  const reopened = await page(t, { memory: p.memory });
  assert.equal(reopened.field('surname').value, 'NGUYEN');
  assert.equal(reopened.field('routeCity').value, '');
});

test('rapid resubmit and confirmation toggles cannot start a second in-flight request', async t => {
  const p = await page(t, { saved: { applicant, receipt: null } });
  const confirm = p.document.querySelector('#confirmed');
  const form = p.document.querySelector('#form');
  confirm.checked = true; p.dispatch(confirm, 'change');
  p.dispatch(form, 'submit', { cancelable: true });
  confirm.checked = false; p.dispatch(confirm, 'change');
  confirm.checked = true; p.dispatch(confirm, 'change');
  p.dispatch(form, 'submit', { cancelable: true });
  assert.equal(p.posts.length, 1);
  assert.equal(p.document.querySelector('#submit').disabled, true);
});

test('submit remains disabled until link initialization is complete', async t => {
  const p = await page(t, { deferred: true });
  const confirm = p.document.querySelector('#confirmed');
  confirm.checked = true; p.dispatch(confirm, 'change');
  assert.equal(p.document.querySelector('#submit').disabled, true);
  await p.ready();
  assert.equal(p.document.querySelector('#submit').disabled, false);
});

test('blur saves the padded date after the date widget finishes synchronizing', async t => {
  const p = await page(t);
  const day = p.document.querySelector('[data-date="birthDate"] [data-part="day"]');
  day.value = '1'; p.dispatch(day, 'input'); p.dispatch(day, 'blur');
  await flush();
  assert.equal(JSON.parse(p.memory.get(draftKey)).applicant.birthDate, '01//');
});

test('manual passport expiry remains intact after restore and issue-date editing', async t => {
  const p = await page(t, { saved: { applicant: { ...applicant, passportExpiry: '02/01/2031' }, receipt: null } });
  const year = p.document.querySelector('[data-date="passportIssue"] [data-part="year"]');
  year.value = '2021'; p.dispatch(year, 'input');
  assert.equal(p.field('passportExpiry').value, '02/01/2031');
});

test('initial rejection readback preserves edits made while it was loading', async t => {
  const receipt = { id: 'test-submission', status: 'pending', revision: 0, queueNo: 1 };
  const p = await page(t, { deferred: true, saved: { applicant, receipt } });
  p.field('birthPlace').value = 'Da Nang'; p.dispatch(p.field('birthPlace'), 'input');
  await p.ready({ ...linkData, submission: { ...receipt, status: 'rejected', correctionFields: ['birthPlace'], applicant } });
  assert.equal(p.field('birthPlace').value, 'DA NANG');
  assert.equal(JSON.parse(p.memory.get(draftKey)).applicant.birthPlace, 'DA NANG');
});

test('delayed initialization waits for IME completion before restoring the form', async t => {
  const p = await page(t, { deferred: true, saved: { applicant, receipt: null } });
  const input = p.field('surname');
  p.dispatch(input, 'compositionstart'); input.value = 'Nguyễn mới';
  input.dispatchEvent(new p.window.InputEvent('input', { bubbles: true, isComposing: true }));
  await p.ready();
  assert.equal(input.value, 'Nguyễn mới');
  p.dispatch(input, 'compositionend'); await flush();
  assert.equal(input.value, 'NGUYEN MOI');
  assert.equal(JSON.parse(p.memory.get(draftKey)).applicant.surname, 'NGUYEN MOI');
});

test('in-flight submission locks editing and starts one status poll after acceptance', async t => {
  const p = await page(t, { saved: { applicant, receipt: null } });
  assert.equal(p.timers.length, 0);
  const confirm = p.document.querySelector('#confirmed'); confirm.checked = true; p.dispatch(confirm, 'change');
  p.dispatch(p.document.querySelector('#form'), 'submit', { cancelable: true });
  assert.equal(p.field('birthPlace').disabled, true);
  p.posts[0].resolve({ ok: true, json: async () => ({ ok: true, submission: { id: 'new-submission', status: 'pending', revision: 0, queueNo: 1 } }) });
  await flush();
  assert.equal(p.field('birthPlace').disabled, false);
  assert.equal(p.timers.length, 1);
  assert.equal(p.timers[0].delay, 15000);
});

test('rejected submit carries the receipt revision to the server', async t => {
  const receipt = { id: 'test-submission', status: 'rejected', revision: 3, queueNo: 1 };
  const seed = await page(t, { saved: { applicant, receipt: null } });
  const completeApplicant = JSON.parse(seed.memory.get(draftKey)).applicant;
  const p = await page(t, { saved: { applicant: completeApplicant, receipt }, data: { ...linkData, submission: { ...receipt, applicant: completeApplicant } } });
  const confirm = p.document.querySelector('#confirmed'); confirm.checked = true; p.dispatch(confirm, 'change');
  p.dispatch(p.document.querySelector('#form'), 'submit', { cancelable: true });
  assert.equal(p.posts[0].payload.expectedRevision, 3);
});

test('newer status revision cannot relabel an old draft as current without explicit reload', async t => {
  const seed = await page(t, { saved: { applicant, receipt: null } });
  const completeApplicant = JSON.parse(seed.memory.get(draftKey)).applicant;
  const receipt = { id: 'test-submission', status: 'rejected', revision: 0, queueNo: 1 };
  const p = await page(t, { saved: { applicant: completeApplicant, receipt }, data: { ...linkData, submission: { ...receipt, applicant: completeApplicant } } });
  const newer = { ...linkData, submission: { ...receipt, revision: 1, correctionFields: ['phone'], applicant: { ...completeApplicant, birthPlace: 'DA NANG' } } };
  p.status(newer);
  p.timers[0].callback(); await flush();
  assert.equal(JSON.parse(p.memory.get(draftKey)).receipt.revision, 0);
  assert.equal(p.field('birthPlace').value, 'HA NOI');
  assert.match(p.document.querySelector('#refreshReturned').textContent, /Tải phiên bản mới/);
  let resolveStatus;
  p.status(new Promise(resolve => { resolveStatus = resolve; }));
  p.dispatch(p.document.querySelector('#refreshReturned'), 'click');
  p.dispatch(p.field('surname'), 'compositionstart'); p.field('surname').value = 'Nguyễn mới';
  resolveStatus(newer); await flush();
  assert.equal(p.field('surname').value, 'Nguyễn mới');
  assert.equal(JSON.parse(p.memory.get(draftKey)).receipt.revision, 0);
  p.dispatch(p.field('surname'), 'compositionend'); p.status(newer);
  p.dispatch(p.document.querySelector('#refreshReturned'), 'click'); await flush();
  assert.equal(p.field('birthPlace').value, 'DA NANG');
  assert.equal(JSON.parse(p.memory.get(draftKey)).receipt.revision, 1);
});

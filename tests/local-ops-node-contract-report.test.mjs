import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNodeTestSummary,classifySavedNodeContract,decodeSavedBuffer} from '../scripts/local-ops-node-contract-report.mjs';
const sha='8c84784f73f653cc99d6a8851e9b1f4bda822a60';
const prior={exactSHA:sha,exactSHAPass:true,primaryCheckoutUnchanged:true,nodeContract:'BLOCKED'};
const tap='# tests 7\n# suites 0\n# pass 7\n# fail 0\n# skipped 0\n# cancelled 0\n# todo 0\n';
const spec='✔ check (0.2ms)\nℹ tests 7\nℹ pass 7\nℹ fail 0\nℹ skipped 0\n';
const mojibake='Γ£ö check (0.2ms)\nΓä╣ tests 7\nΓä╣ pass 7\nΓä╣ fail 0\n';
test('accepts strict TAP and separately recorded exit 0',()=>{
  const x=parseNodeTestSummary(tap,{exitCode:0});
  assert.equal(x.verdict,'PASS_WITH_RECORDED_EXIT');assert.equal(x.processExitVerified,true);
});
test('accepts Node 24 spec without ASCII # prefix',()=>{
  assert.equal(parseNodeTestSummary(spec).verdict,'PASS_LOG_ONLY');
});
test('accepts mojibake UI markers without pretending process exit verified',()=>{
  const x=classifySavedNodeContract({originalReport:prior,log:mojibake,expectedSha:sha});
  assert.equal(x.verdict,'PASS_LOG_ONLY');assert.equal(x.processExitVerified,false);
  assert.equal(x.shutdownAuthorized,false);assert.equal(x.autoRestartAllowed,false);
});
test('rejects wrong SHA or modified checkout readback',()=>{
  assert.equal(classifySavedNodeContract({originalReport:prior,log:tap,expectedSha:'b'.repeat(40)}).verdict,'BLOCKED_UNVERIFIED_SOURCE');
  assert.equal(classifySavedNodeContract({originalReport:{...prior,primaryCheckoutUnchanged:false},log:tap,expectedSha:sha}).verdict,'BLOCKED_UNVERIFIED_SOURCE');
});
test('rejects missing or contradictory summaries',()=>{
  assert.equal(parseNodeTestSummary('# tests 7\n# pass 7\n').verdict,'BLOCKED_NO_SUMMARY');
  assert.equal(parseNodeTestSummary(tap+'# pass 7\n').verdict,'BLOCKED_AMBIGUOUS_SUMMARY');
  assert.equal(parseNodeTestSummary(tap.replace('# fail 0','# fail 1')).verdict,'BLOCKED_FAILED_OR_INCOMPLETE');
});
test('exit nonzero cannot be overridden by an all-green log',()=>{
  assert.equal(parseNodeTestSummary(spec,{exitCode:1}).verdict,'BLOCKED_NONZERO_EXIT');
});
test('untrusted free-form text cannot impersonate reporter summary',()=>{
  assert.equal(parseNodeTestSummary('PRINT tests 7\nPRINT pass 7\nPRINT fail 0').verdict,'BLOCKED_NO_SUMMARY');
});

test('PowerShell 5 UTF-16LE Tee-Object and UTF-8-BOM JSON decode safely',()=>{
  const utf16=Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(mojibake,'utf16le')]);
  const utf8bom=Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(JSON.stringify(prior),'utf8')]);
  const log=decodeSavedBuffer(utf16),originalReport=JSON.parse(decodeSavedBuffer(utf8bom));
  assert.equal(classifySavedNodeContract({originalReport,log,expectedSha:sha}).verdict,'PASS_LOG_ONLY');
  assert.throws(()=>decodeSavedBuffer(Buffer.from([0xfe,0xff,0,1])),/EVIDENCE_UTF16BE_UNSUPPORTED/);
});

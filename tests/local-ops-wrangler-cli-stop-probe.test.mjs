import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {classifyWranglerCliStop,buildPassiveWindowsProbe} from '../scripts/local-ops-wrangler-cli-stop-probe.mjs';

const sha='a'.repeat(40);
test('Windows child.kill(SIGINT/SIGTERM) always refuses graceful stop',()=>{
  for(const stopMethod of ['node-sigint','node-sigterm']) {
    const report=classifyWranglerCliStop({platform:'win32',stopMethod});
    assert.equal(report.stopAuthorized,false);
    assert.ok(report.blockers.includes('NODE_WINDOWS_KILL_IS_ABRUPT_NOT_GRACEFUL'));
  }
});
test('interactive CLI x and terminal Ctrl+C are not authenticated exit ACK',()=>{
  for(const stopMethod of ['interactive-x','terminal-ctrl-c']) {
    const report=classifyWranglerCliStop({platform:'win32',stopMethod});
    assert.equal(report.cliGracefulStopVerified,false);
    assert.equal(report.processBoundNoncePidShaReceipt,false);
  }
});
test('Wrangler unstable_dev API stop cannot be recast as independent CLI ACK',()=>{
  const report=classifyWranglerCliStop({platform:'win32',stopMethod:'api-stop'});
  assert.ok(report.blockers.includes('WRANGLER_API_STOP_IS_NOT_INDEPENDENT_CLI_STOP'));
  assert.equal(report.ready,false);
});
test('even mocked Windows CLI native exit without extra evidence stays blocked',()=>{
  const report=classifyWranglerCliStop({platform:'win32',stopMethod:'none'});
  assert.equal(report.documentedCliNativeStopAck,false);
  assert.equal(report.backgroundWaitUntilAndD1Drained,false);
  assert.equal(report.allWorkerIsolatesEnumerated,false);
  assert.equal(report.cliRuntimeSpawned,false);
  assert.equal(report.d1Touched,false);
  assert.equal(report.autoRestartAllowed,false);
});
test('non-Windows execution never claims Windows runtime evidence',()=>{
  const report=classifyWranglerCliStop({platform:'linux',stopMethod:'none'});
  assert.ok(report.blockers.includes('WINDOWS_CLI_RUNTIME_NOT_OBSERVED'));
});
test('unknown stop methods are rejected rather than treated as capabilities',()=>{
  assert.throws(()=>classifyWranglerCliStop({platform:'win32',stopMethod:'remote-stop'}),
    /UNRECOGNIZED_CLI_STOP_METHOD/);
});
test('pinned CLI and exact HEAD readback without launching Wrangler',()=>{
  const dir=mkdtempSync(join(tmpdir(),'am-passive-stop-qa-'));
  try {
    execFileSync('git',['init','-q',dir],{windowsHide:true});
    execFileSync('git',['-C',dir,'-c','user.name=QA','-c','user.email=qa@example.invalid',
      'commit','--allow-empty','-qm','initial'],{windowsHide:true});
    const head=execFileSync('git',['-C',dir,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
    writeFileSync(join(dir,'package.json'),JSON.stringify({devDependencies:{wrangler:'4.92.0'}}));
    const report=buildPassiveWindowsProbe({projectRoot:dir,expectedSha:head,platform:'win32'});
    assert.equal(report.exactShaVerified,true);
    assert.equal(report.wranglerDeclaredVersion,'4.92.0');
    assert.equal(report.noCheckoutMutation,true);
    assert.equal(report.cliRuntimeSpawned,false);
    assert.throws(()=>buildPassiveWindowsProbe({projectRoot:dir,expectedSha:sha,platform:'win32'}),
      /CLI_STOP_PROBE_EXACT_SHA_MISMATCH/);
    writeFileSync(join(dir,'package.json'),JSON.stringify({devDependencies:{wrangler:'^4.92.0'}}));
    assert.throws(()=>buildPassiveWindowsProbe({projectRoot:dir,expectedSha:head,platform:'win32'}),
      /WRANGLER_PIN_NOT_EXACT/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('probe source cannot spawn/kill Wrangler or modify local storage',()=>{
  const content=readFileSync(new URL('../scripts/local-ops-wrangler-cli-stop-probe.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(content,/\bspawn\s*\(/);
  assert.doesNotMatch(content,/\bkill\s*\(/);
  assert.doesNotMatch(content,/\bwrangler\s+d1\s+execute\b/);
  assert.match(content,/documentedCliNativeStopAck:false/);
});

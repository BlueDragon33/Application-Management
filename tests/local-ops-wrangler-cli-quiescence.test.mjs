import assert from 'node:assert/strict';
import test from 'node:test';
import {createWranglerCliQuiescenceGate,
  WRANGLER_CLI_QUIESCENCE_PROTOCOL as PROTOCOL} from '../scripts/local-ops-wrangler-cli-quiescence.mjs';
const expected={serviceId:'BAUMAN-CONTROL',sourceSha:'a'.repeat(40),
  bootNonce:'B'.repeat(32),supervisorPid:110,wranglerPid:120,
  gatewayPort:3003,backendPort:13003,expectedD1Bindings:['DB']};
const receipt=(change={})=>({protocol:PROTOCOL,serviceId:expected.serviceId,
  sourceSha:expected.sourceSha,bootNonce:expected.bootNonce,
  supervisorPid:expected.supervisorPid,wranglerPid:expected.wranglerPid,...change});
test('invalid source, shared PID, weak nonce and port conflicts fail closed',()=>{
  for(const change of [{sourceSha:'bad'},{bootNonce:'a'},
    {wranglerPid:110},{backendPort:3003},{expectedD1Bindings:['DB','DB']}])
    assert.throws(()=>createWranglerCliQuiescenceGate({...expected,...change}),
      /WRANGLER_CLI_EXPECTATION_INVALID/);
});
test('no receipts never permit real Wrangler CLI shutdown',()=>{
  const gate=createWranglerCliQuiescenceGate(expected);
  assert.equal(gate.status().stopAuthorized,false);
  assert.ok(gate.status().missingEvidence.includes('INFLIGHT_OR_BACKGROUND_D1_UNVERIFIED'));
  assert.equal(gate.status().runtimeGlobalQuiescenceVerified,false);
});
test('wrong SHA PID nonce taints this attempt; replay is rejected',()=>{
  const gate=createWranglerCliQuiescenceGate(expected);
  for(const bad of [{sourceSha:'f'.repeat(40)},{wranglerPid:42},{bootNonce:'C'.repeat(32)}])
    assert.equal(gate.ingest('ingress',receipt(bad)).accepted,false);
  assert.equal(gate.ingest('ingress',receipt({closed:true,pending:0,uncertain:false})).accepted,true);
  assert.equal(gate.ingest('ingress',receipt()).reason,'INGRESS_RECEIPT_REPLAY');
  assert.ok(gate.status().missingEvidence.includes('RECEIPT_IDENTITY_TAINTED'));
});
test('gateway-drained does not imply waitUntil/background D1 drained',()=>{
  const gate=createWranglerCliQuiescenceGate(expected);
  gate.ingest('ingress',receipt({closed:true,pending:0,uncertain:false,bypassUnexcluded:false}));
  gate.ingest('worker',receipt({activeD1:0,backgroundD1:1,
    allBindingsInstrumented:true,waitUntilInstrumented:true,unknownAsyncWork:false}));
  assert.equal(gate.status().observedIngressClosed,true);
  assert.equal(gate.status().observedD1Idle,false);
  assert.equal(gate.status().stopAuthorized,false);
});
test('durable readback by Worker alone cannot prove independent D1 barrier',()=>{
  const gate=createWranglerCliQuiescenceGate(expected);
  gate.ingest('storage',receipt({independentCliReadback:false,
    commitBarrierVerified:true,verifiedSha:expected.sourceSha,bindings:['DB']}));
  assert.ok(gate.status().missingEvidence.includes('D1_INDEPENDENT_DURABILITY_UNVERIFIED'));
});
test('even forged all-green receipts never grant authorization',()=>{
  const gate=createWranglerCliQuiescenceGate(expected);
  gate.ingest('ingress',receipt({closed:true,pending:0,uncertain:false,bypassUnexcluded:false}));
  gate.ingest('worker',receipt({activeD1:0,backgroundD1:0,
    waitUntilInstrumented:true,allBindingsInstrumented:true,unknownAsyncWork:false,
    runtimeIsolateCensusVerified:true}));
  gate.ingest('storage',receipt({independentCliReadback:true,
    commitBarrierVerified:true,verifiedSha:expected.sourceSha,bindings:['DB']}));
  gate.ingest('exit',receipt({cliExited:true,exitCode:0,forcedTermination:false,
    cliNativeGracefulAck:true,descendantsGone:true,
    gatewayPortReleased:true,backendPortReleased:true,platform:'win32'}));
  const s=gate.status();
  assert.deepEqual(s.missingEvidence,['AUTHORITATIVE_RUNTIME_BARRIER_NOT_IMPLEMENTED']);
  assert.equal(s.gracefulCliShutdownVerified,false);
  assert.equal(s.stopAuthorized,false);
  assert.equal(s.autoRestartAllowed,false);
  assert.equal(s.ready,false);
});
test('SIGTERM and unobserved Windows descendants are not a graceful ACK',()=>{
  const gate=createWranglerCliQuiescenceGate(expected);
  gate.ingest('exit',receipt({cliExited:true,exitCode:0,forcedTermination:true,
    cliNativeGracefulAck:false,descendantsGone:false,
    gatewayPortReleased:true,backendPortReleased:true,platform:'win32'}));
  assert.ok(gate.status().missingEvidence.includes('WRANGLER_CLI_NATIVE_GRACEFUL_ACK_UNVERIFIED'));
  assert.ok(gate.status().missingEvidence.includes('WINDOWS_PID_TREE_AND_PORTS_UNVERIFIED'));
});

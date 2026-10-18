import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {execFileSync} from "node:child_process";
import {parseListeningPorts,portObservation,collectObservations,writeReport} from "../scripts/windows-readonly-acceptance.mjs";

test("Windows netstat parses only listening endpoint/PID and rejects LAN binding as ready",()=>{
  const raw=[
    "  TCP    127.0.0.1:3000        0.0.0.0:0          LISTENING       1240",
    "  TCP    [::1]:3004             [::]:0             LISTENING       450",
    "  TCP    0.0.0.0:3010          0.0.0.0:0          LISTENING       670",
    "  TCP    127.0.0.1:3005        127.0.0.1:50004    ESTABLISHED     1200",
    "  TCP    127.0.0.1:3000        127.0.0.1:50005    ESTABLISHED     1240",
  ].join("\r\n");
  const parsed=parseListeningPorts(raw);
  assert.deepEqual(portObservation(3000,parsed).pids,[1240]);
  assert.equal(portObservation(3004,parsed).listener,"LOOPBACK_LISTENER");
  assert.equal(portObservation(3010,parsed).listener,"NON_LOOPBACK_BIND");
  assert.equal(portObservation(3005,parsed).listener,"STOPPED");
  assert.equal(portObservation(3001,parsed,"UNAVAILABLE").listener,"TCP_OBSERVATION_UNAVAILABLE");
});
test("passive collector never claims owner acceptance or D1 proof with an unavailable workspace",()=>{
  const src=readFileSync(new URL("../scripts/windows-readonly-acceptance.mjs",import.meta.url),"utf8");
  const vbs=readFileSync(new URL("../QA_BAUMANWEB_READONLY.vbs",import.meta.url),"utf8");
  const p=collectObservations({workspaceRoot:join(tmpdir(),"fake-BaumanWeb"),
    portMap:parseListeningPorts(""),netstatState:"UNAVAILABLE"});
  assert.equal(p.ownerAcceptance,"UNVERIFIED");
  assert.equal(p.mergeAuthorization,"NOT_GRANTED");
  assert.equal(p.d1Shutdown,"BLOCKED_NOT_TESTED");
  assert.equal(p.activeHttpProbeEnabled,false);
  assert.equal(p.manager.http.listener,"TCP_OBSERVATION_UNAVAILABLE");
  assert.equal(p.usesPowershell,false);
  assert.equal(p.manifest,"MISSING_LOCAL_MANIFEST");
  assert.equal(p.catalogSource,"EMBEDDED_PR360_REFERENCE_NOT_INSTALLED");
  assert.equal(p.catalogIsInstalled,false);
  assert.equal(p.apps.length,10);
  assert.equal(p.apps.filter(a=>a.capability==="WEB").length,7);
  assert.ok(p.apps.find(a=>a.id==="boi-ech" && a.runtime.port===3004));
  assert.ok(p.apps.every(a=>a.git.state==="MISSING_DIRECTORY"));
  assert.ok(src.includes('GIT_OPTIONAL_LOCKS:"0"'));
  assert.ok(!src.includes('fetch('));
  assert.ok(!src.includes('https://'));
  assert.ok(!src.includes('execSync('));
  assert.match(vbs,/node.exe/);
  assert.doesNotMatch(vbs,/powershell\.exe|-ExecutionPolicy|runas|cmd\.exe/i);
  const dir=mkdtempSync(join(tmpdir(),"qa-readonly-test-"));
  try{
    writeReport(p,dir);
    const report=JSON.parse(readFileSync(join(dir,"latest.json"),"utf8"));
    assert.equal(report.verdict,"BLOCKED_NEEDS_HUMAN_REVIEW");
    assert.ok(readFileSync(join(dir,"latest.txt"),"utf8").includes("D1: BLOCKED_NOT_TESTED"));
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test("Node command runs without PowerShell and returns a passive, blocked report",()=>{
  const dir=mkdtempSync(join(tmpdir(),"qa-process-"));
  try{
    execFileSync(process.execPath,[fileURLToPath(new URL("../scripts/windows-readonly-acceptance.mjs",import.meta.url)),
      "--workspace",join(dir,"BaumanWeb"),"--report-dir",dir],{timeout:10000,encoding:"utf8"});
    const result=JSON.parse(readFileSync(join(dir,"latest.json"),"utf8"));
    assert.equal(result.verdict,"BLOCKED_NEEDS_HUMAN_REVIEW");
    assert.equal(result.activeHttpProbeEnabled,false);
    assert.equal(result.usesPowershell,false);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

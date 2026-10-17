import assert from "node:assert/strict";
import test from "node:test";
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {readdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {assertManagedControlAdmission,assertNoManagedArgvSecrets,inspectManagedWorkerSource} from "../scripts/local-ops-managed-startup-policy.mjs";

test("managed policy blocks legacy --var and pinned npx wrappers before child launch",()=>{
  assert.throws(()=>assertNoManagedArgvSecrets({managed:true,command:"node",args:[
    "wrangler","dev","--var","PRICE_REPORT_CONTROL_SERVICE_SECRET:a-secret"
  ]}),/MANAGED_ARGV_SECRET_OR_WRAPPER_BLOCKED/);
  assert.throws(()=>assertNoManagedArgvSecrets({managed:true,command:"npx.cmd",args:[
    "--yes","wrangler@4.136.3","dev"
  ]}),/MANAGED_ARGV_SECRET_OR_WRAPPER_BLOCKED/);
  assert.throws(()=>assertNoManagedArgvSecrets({managed:true,command:"npx.cmd",args:["wrangler","dev"]}),/MANAGED_NPX_WRAPPER_BLOCKED/);
  assert.deepEqual(assertNoManagedArgvSecrets({managed:true,command:process.execPath,args:["/node_modules/wrangler/bin/wrangler.js","dev"]}),
    {legacy:false,secureManaged:true});
  assert.equal(assertNoManagedArgvSecrets({managed:false,command:"npx.cmd",args:["--var","SECRET:legacy"]}).legacy,true);
});

test("missing source guard and unapproved source must both fail before managed migrations",t=>{
  const root=mkdtempSync(join(tmpdir(),"am-source-admission-"));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const bauman=join(root,"Bauman-master-ai-system","control-service","src");
  const price=join(root,"PriceReport_Tunggiabao","control-service","src");
  mkdirSync(bauman,{recursive:true});mkdirSync(price,{recursive:true});
  writeFileSync(join(bauman,"automation-contract.ts"),"// old source\n");
  writeFileSync(join(price,"index.ts"),"// old source\n");
  assert.equal(inspectManagedWorkerSource(root,"BAUMAN-CONTROL").sourceGuardPresent,false);
  assert.throws(()=>assertManagedControlAdmission({managed:true,appsRoot:root}),/SOURCE_GUARD_MISSING/);
  const markers="verifyManagedIngress(request, incomingEnv; localD1Observer.blockedPreflight()";
  writeFileSync(join(bauman,"automation-contract.ts"),markers);
  writeFileSync(join(price,"index.ts"),markers);
  assert.equal(inspectManagedWorkerSource(root,"BAUMAN-CONTROL").sourceGuardPresent,true);
  assert.throws(()=>assertManagedControlAdmission({managed:true,appsRoot:root}),/REVIEW_AND_SHA_BLOCKED/);
  assert.deepEqual(assertManagedControlAdmission({managed:false,appsRoot:root}),
    {mode:"legacy-manual",allowed:true});
});
test("both runtime entrypoints must perform managed gate before migration or spawning",()=>{
  const read=(path)=>requireFile(path);
  function requireFile(path){
    return readFileSync(new URL("../"+path,import.meta.url),"utf8");
  }
  const all=read("scripts/run-all.mjs"),nested=read("scripts/run-local-system.mjs");
  for(const entry of [all,nested]){
    assert.match(entry,/assertManagedControlAdmission/);
    assert.match(entry,/assertNoManagedArgvSecrets/);
    const actual=entry.lastIndexOf("assertManagedControlAdmission(");
    const startup=entry.indexOf("async function main()");
    const knownPostGate=entry===all ? entry.indexOf('  requireFile(join(growUpRoot',actual) : entry.indexOf('  for (const [key, path] of Object.entries(paths)) requirePath',actual);
    assert.ok(startup>=0&&actual>startup&&knownPostGate>actual,"admission before first workspace/migration step");
  }
});

test("real managed launchers reject old-source stack BEFORE migration, install or secret-spawn",t=>{
  const dir=mkdtempSync(join(tmpdir(),"am-managed-fail-closed-"));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const filesBefore=readdirSync(dir);
  for(const entry of ["run-all.mjs","run-local-system.mjs"]){
    const script=fileURLToPath(new URL("../scripts/"+entry,import.meta.url));
    const run=spawnSync(process.execPath,[script,"--apps-root",dir],{
      encoding:"utf8",timeout:10000,windowsHide:true,
      env:{...process.env,LOCAL_OPS_BOOT_NONCE:"qa-nonce-no-approval"}
    });
    assert.equal(run.status,1,entry+" must not start the managed stack");
    assert.match(run.stderr,/MANAGED_CONTROL_SOURCE_GUARD_MISSING/,entry);
    assert.deepEqual(readdirSync(dir),filesBefore,
      "no D1 migrations, npm install or created files before rejection");
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import {mkdtempSync,mkdirSync,writeFileSync,chmodSync,rmSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {createManagedWranglerCandidate} from "../scripts/local-ops-managed-wrangler-candidate.mjs";
import {createPrivateWranglerProof} from "../scripts/local-ops-private-wrangler-proof.mjs";
test("isolated local Wrangler candidate injects no argv/env secrets and never enables stop",async t=>{
  const dir=mkdtempSync(join(tmpdir(),"managed-candidate-"));
  t.after(()=>rmSync(dir,{recursive:true,force:true,maxRetries:6,retryDelay:200}));
  mkdirSync(join(dir,"node_modules","wrangler","bin"),{recursive:true});
  const bin=join(dir,"node_modules","wrangler","bin","wrangler.js");
  writeFileSync(bin,"// local pinned Wrangler fixture only\n");
  const credential=await createPrivateWranglerProof({prefix:"qa-candidate-test-"});
  t.after(()=>credential.cleanup());
  const conf=join(credential.dir,"wrangler.json");writeFileSync(conf,"{}");
  const proof=credential.proof;
  const launch=createManagedWranglerCandidate({projectRoot:dir,configFile:conf,
    credential,persistDir:join(dir,"storage"),backendPort:14303});
  assert.equal(launch.command,process.execPath);
  assert.equal(launch.args[0].endsWith("wrangler.js"),true);
  assert.ok(launch.args.includes("--local"));
  assert.equal(launch.args.includes("--var"),false);
  assert.equal(launch.args.some(x=>x.includes(proof)),false);
  assert.equal(Object.values(launch.env).some(x=>x.includes(proof)),false);
  assert.equal(launch.publicEvidence.autoRestartAllowed,false);
  assert.equal(launch.publicEvidence.sourceAdmissionReviewed,false);
  assert.equal(launch.gateway.status().safeToStopWrangler,false);
  assert.equal(JSON.stringify(launch.publicEvidence).includes(proof),false);
  assert.throws(()=>createManagedWranglerCandidate({projectRoot:dir,configFile:conf,
    credential:{...credential,proof:"r".repeat(48)},persistDir:join(dir,"storage"),backendPort:14303}),
    /CREDENTIAL_UNTRUSTED/);
  assert.throws(()=>createManagedWranglerCandidate({projectRoot:dir,configFile:conf,
    credential,persistDir:join(dir,"storage"),backendPort:80}),
    /PORT_INVALID/);
});

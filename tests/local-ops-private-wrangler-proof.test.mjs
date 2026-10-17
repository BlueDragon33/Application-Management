import assert from "node:assert/strict";
import test from "node:test";
import { readFile, stat } from "node:fs/promises";
import { createPrivateWranglerProof, assertNoSecretInArgs } from "../scripts/local-ops-private-wrangler-proof.mjs";

test("per-boot private Wrangler proof never appears in CLI args, status, or log evidence",async()=>{
 const fixture=await createPrivateWranglerProof({prefix:"am-secret-check-"});
 try {
   const data=await readFile(fixture.file,"utf8");
   assert.match(data,/LOCAL_OPS_GATEWAY_REQUIRED="1"/);
   assert.ok(data.includes(fixture.proof));
   assert.ok(data.includes('PRICE_REPORT_CONTROL_SERVICE_SECRET="'+ "s".repeat(48)+'"'));
   assert.ok(data.includes('APPLICATION_MANAGEMENT_ORIGIN="http://127.0.0.1:3000"'));
   assert.equal(fixture.proof.length>=48,true);
   const args=["dev","--config",fixture.dir+"/wrangler.qa.json","--local"];
   assert.equal(assertNoSecretInArgs(args,fixture.proof),true);
   assert.throws(()=>assertNoSecretInArgs([...args,fixture.proof],fixture.proof),
     /SECRET_EXPOSED_IN_PROCESS_ARGUMENTS/);
   assert.equal(JSON.stringify(fixture.publicStatus).includes(fixture.proof),false);
   assert.equal(fixture.publicStatus.proofInArgs,false);
   assert.equal(fixture.publicStatus.proofInEnvironment,false);
   if(process.platform!=="win32") {
     const dir=await stat(fixture.dir),file=await stat(fixture.file);
     assert.equal(dir.mode&0o077,0);
     assert.equal(file.mode&0o077,0);
   } else assert.equal(fixture.publicStatus.windowsOwnerAclEnforced,true);
 }finally {await fixture.cleanup();}
 await assert.rejects(readFile(fixture.file,"utf8"),/ENOENT/);
});
test("weak prefixes and empty credentials never get accepted",async()=>{
 await assert.rejects(createPrivateWranglerProof({prefix:"../outside"}),/PREFIX_INVALID/);
 assert.throws(()=>assertNoSecretInArgs([],"weak"),/AUDIT_INVALID/);
 await assert.rejects(createPrivateWranglerProof({bindings:{"LOCAL_OPS_INGRESS_PROOF":"bad"}}),/SECRET_BINDING_UNSAFE/);
 await assert.rejects(createPrivateWranglerProof({bindings:{"PRICE_REPORT_CONTROL_SERVICE_SECRET":"x\nnewline"}}),/SECRET_BINDING_UNSAFE/);
});

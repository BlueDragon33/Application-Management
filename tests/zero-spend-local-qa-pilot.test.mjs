import test from "node:test";
import assert from "node:assert/strict";
import {parseZeroSpendReport} from "../app/projects/zero-spend/zero-spend-report.mjs";

function example() {
  return {
    schema:"blueprint-os/local-zero-spend-candidate/v1",status:"NOT_RATIFIED",
    githubHostedMinutesConsumedByAudit:0,billingNotVerifiedLive:true,sourceSHAReadback:false,
    inventoryCount:2,scanned:1,workflowCount:1,
    repositories:[
      {repository:"Bauman-Russian-iOS",status:"STATIC_LOCAL_AUDIT_ONLY",visibility:"private",
        workflows:[{file:"ios-p2-build.yml",events:["pull_request"],triggerKind:"AUTO_OR_REUSABLE",
          runnerTypes:["macos"],risk:"PRIVATE_AUTO_REVIEW",costUnknown:true,ciExecuted:false}]},
      {repository:"MissingApp",status:"NOT_CHECKED_LOCAL_REPO_MISSING",workflows:[]}
    ]
  };
}
test("real report shape is a candidate, not CI or billing PASS",()=>{
  const v=parseZeroSpendReport(JSON.stringify(example()));
  assert.equal(v.scanned,1);
  assert.equal(v.unchecked,1);
  assert.equal(v.rows.find(x=>x.name==="MissingApp").risk,"NOT_CHECKED");
  assert.equal(v.rows[0].scope,undefined);
  assert.equal(v.scope,"STATIC_OWNER_SUPPLIED_REPORT_UNVERIFIED");
});
test("reject invented verified source SHA",()=>{
 const x=example();x.sourceSHAReadback=true;
 assert.throws(()=>parseZeroSpendReport(x),/BLOCKED_INVALID_AUDIT/);
});
test("reject fake authority",()=>{
 const x=example();x.status="RATIFIED";
 assert.throws(()=>parseZeroSpendReport(x),/BLOCKED_INVALID_AUDIT/);
});
test("reject misleading audit workflow count",()=>{
 const x=example();x.workflowCount=22;
 assert.throws(()=>parseZeroSpendReport(x),/BLOCKED_INVALID_AUDIT/);
});
test("reject missing local repo claiming it inspected workflows",()=>{
 const x=example();x.repositories[1].workflows.push(x.repositories[0].workflows[0]);
 assert.throws(()=>parseZeroSpendReport(x),/BLOCKED_INVALID_AUDIT/);
});
test("reject forged CI PASS",()=>{
 const x=example();x.repositories[0].workflows[0].ciExecuted=true;
 assert.throws(()=>parseZeroSpendReport(x),/BLOCKED_INVALID_AUDIT/);
});
test("reject executable or path-traversal workflow names",()=>{
 const x=example();x.repositories[0].workflows[0].file="../../secret.yml";
 assert.throws(()=>parseZeroSpendReport(x),/BLOCKED_INVALID_AUDIT/);
});
test("reject duplicate repos",()=>{
 const x=example();x.repositories[1].repository="bauman-russian-ios";
 assert.throws(()=>parseZeroSpendReport(x),/BLOCKED_INVALID_AUDIT/);
});
test("reject duplicate workflow files",()=>{
 const x=example();x.repositories[0].workflows.push({...x.repositories[0].workflows[0]});
 x.workflowCount=2;
 assert.throws(()=>parseZeroSpendReport(x),/BLOCKED_INVALID_AUDIT/);
});
test("reject nonzero GitHub-hosted minutes in source audit",()=>{
 const x=example();x.githubHostedMinutesConsumedByAudit=2;
 assert.throws(()=>parseZeroSpendReport(x),/BLOCKED_INVALID_AUDIT/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const workflows=[
  {
    "path": ".github/workflows/live-development-deploy.yml",
    "job": "deploy-live",
    "marker": "Deploy current main to live Worker"
  },
  {
    "path": ".github/workflows/bootstrap-managed-client-production.yml",
    "job": "bootstrap",
    "marker": "Checkout BOIECH_AI"
  },
  {
    "path": ".github/workflows/deploy-application-management-preview.yml",
    "job": "deploy-preview",
    "marker": "Application Management Cloudflare preview read-back PASS"
  }
];
for(const wf of workflows){
 test("offline-first: "+wf.path+" cannot publish automatically or manually",()=>{
  const text=readFileSync(wf.path,"utf8");
  const eventBlock=text.slice(text.indexOf("\non:"),text.indexOf("\npermissions:"));
  assert.match(eventBlock,/workflow_dispatch:/);
  assert.doesNotMatch(eventBlock,/\bpush:|\bworkflow_run:|\bissue_comment:/,
   "merging or commenting must not trigger online deployment");
  const escaped=wf.job.replace(/[.*+?^\$\{\}()|[\]\\]/g,"\\$&");
  const re=new RegExp("^  "+escaped+":\\n(?:    #[^\\n]*\\n)*    if: \\$\\{\\{ false \\}\\}","m");
  assert.match(text,re,"deployment job must be held fail-closed even on manual dispatch");
  assert.ok(text.includes(wf.marker),"retain dormant workflow for later reviewed reactivation");
 });
}
test("only the reviewed Production path can publish, with explicit owner and revision gates",()=>{
 const text=readFileSync(".github/workflows/deploy-application-management-production.yml","utf8");
 const eventBlock=text.slice(text.indexOf("\non:"),text.indexOf("\npermissions:"));
 assert.doesNotMatch(eventBlock,/\bpush:|\bworkflow_run:|\bissue_comment:/);
 const job=text.slice(text.indexOf("  deploy-production:"),text.indexOf("    runs-on:",text.indexOf("  deploy-production:")));
 assert.match(job,/github\.event_name == 'workflow_dispatch'/);
 assert.match(job,/github\.actor == 'BlueDragon33'/);
 assert.match(job,/inputs\.confirm == 'DEPLOY_PRODUCTION'/);
 assert.match(job,/inputs\.release_revision == github\.sha/);
 assert.match(text,/environment: application-management-production/);
});
test("offline hold is not proof that an installed app works without internet",()=>{
 const a=readFileSync(".github/workflows/live-development-deploy.yml","utf8");
 assert.match(a,/DORMANT|offline-first/i);
 assert.ok(!/OFFLINE_RUNTIME_PASS|PRODUCTION_AUTHORIZED=true/.test(a));
});

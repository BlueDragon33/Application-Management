import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import yaml from 'js-yaml';
const workflow=yaml.load(fs.readFileSync('.github/workflows/deploy-application-management-preview.yml','utf8'));
test('manual Preview requires exact confirmation before checkout and stays dormant',()=>{
 assert.equal(workflow.on.workflow_dispatch.inputs.confirm.required,true);
 assert.equal(workflow.on.workflow_dispatch.inputs.confirm.type,'string');
 assert.equal(workflow.jobs['deploy-preview'].if,'${{ false }}');
 const steps=workflow.jobs['deploy-preview'].steps;const guard=steps[0];
 assert.match(steps[1].uses,/actions\/checkout/);assert.match(guard.env.APPLICATION_MANAGEMENT_PREVIEW_CONFIRM,/inputs.confirm/);
 for(const value of ['', 'wrong','DEPLOY_PREVIEW; exit 0'])assert.notEqual(spawnSync('bash',['-e','-c',guard.run],{env:{...process.env,APPLICATION_MANAGEMENT_PREVIEW_CONFIRM:value}}).status,0);
 assert.equal(spawnSync('bash',['-e','-c',guard.run],{env:{...process.env,APPLICATION_MANAGEMENT_PREVIEW_CONFIRM:'DEPLOY_PREVIEW'}}).status,0);
});
test('restoring the Preview artifact cannot publish when its guard fails',()=>{
 const step=workflow.jobs['deploy-preview'].steps.find(s=>s.name==='Restore exact Preview artifact after secret versions');
 // Emulate external commands as Bash functions, not filesystem executables.
 // Git-for-Windows receives a native Windows PATH; prepending a POSIX ':' can
 // make bash unresolvable and incorrectly return spawnSync.status === null.
 // Argument matching also guards the exact check-before-deploy contract.
 const guarded=[
  'npm() {',
  '  [[ "$*" == "run cloudflare:artifact:check" ]] || return 90',
  "  printf 'check\\n'",
  '  return "$CHECK_EXIT"',
  '}',
  'npx() {',
  '  [[ "$*" == "wrangler deploy" ]] || return 91',
  "  printf 'publish\\n'",
  '}',
  step.run,
 ].join('\n');
 const execute=(code)=>spawnSync('bash',['-e','-c',guarded],{
  env:{...process.env,CHECK_EXIT:String(code)},encoding:'utf8'
 });
 const rejected=execute(31);
 assert.ifError(rejected.error);
 assert.equal(rejected.status,31,rejected.stderr);
 assert.equal(rejected.stdout,'check\n','Artifact check failure must prevent publish');
 const accepted=execute(0);
 assert.ifError(accepted.error);
 assert.equal(accepted.status,0,accepted.stderr);
 assert.equal(accepted.stdout,'check\npublish\n','Only successful artifact check may publish');
});

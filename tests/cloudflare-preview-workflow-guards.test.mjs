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
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'preview-guard-'));
 try{
  const log=path.join(dir,'calls');
  fs.writeFileSync(path.join(dir,'npm'),'#!/bin/sh\nprintf "check\\n" >> "$CALL_LOG"\nexit "$CHECK_EXIT"\n',{mode:0o755});
  fs.writeFileSync(path.join(dir,'npx'),'#!/bin/sh\nprintf "publish\\n" >> "$CALL_LOG"\n',{mode:0o755});
  let result=spawnSync('bash',['-e','-c',step.run],{env:{...process.env,PATH:dir+':'+process.env.PATH,CALL_LOG:log,CHECK_EXIT:'31'}});
  assert.equal(result.status,31);assert.equal(fs.readFileSync(log,'utf8'),'check\n');
  fs.writeFileSync(log,'');result=spawnSync('bash',['-e','-c',step.run],{env:{...process.env,PATH:dir+':'+process.env.PATH,CALL_LOG:log,CHECK_EXIT:'0'}});
  assert.equal(result.status,0);assert.equal(fs.readFileSync(log,'utf8'),'check\npublish\n');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

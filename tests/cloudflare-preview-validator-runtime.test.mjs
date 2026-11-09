import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {loadTs} from './helpers/load-ts.mjs';

test('source Preview gate accepts the real formatted Worker deployment boundary',()=>{
 const result=spawnSync(process.execPath,['scripts/validate-cloudflare-preview.mjs'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
 assert.match(result.stdout,/migration gate PASS/);
});
test('real Preview metadata is protected anonymously and reports the expected authenticated access mode',async()=>{
 const worker=loadTs('worker/index.ts',{'vinext/server/app-router-entry':{__esModule:true,default:{fetch(){throw new Error('Unexpected renderer delegation');}}}}).default;
 const secret='preview-fixture-secret-that-is-over-thirty-two-bytes';
 const env={APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL:'cloudflare-preview',APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET:secret,CONTROL_OWNER_EMAILS:'owner@example.test',CONTROL_PLANE_NETWORK_MODE:'production',DB:{prepare:()=>({first:async()=>({})})},ASSETS:{fetch:async()=>new Response('application-management-assets-ok-v1')}};
 const url='https://preview.example.test/__deployment';
 assert.equal((await worker.fetch(new Request(url),env,{})).status,401);
 const response=await worker.fetch(new Request(url,{headers:{authorization:`Bearer ${secret}`}}),env,{});
 assert.equal(response.status,200);
 const status=await response.json();assert.equal(status.accessMode,'application-preview-secret');assert.equal(status.previewAccessConfigured,true);assert.equal(status.databaseReady,true);
});

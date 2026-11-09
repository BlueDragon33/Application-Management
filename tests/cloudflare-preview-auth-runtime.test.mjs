import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTs} from './helpers/load-ts.mjs';

test('new token mutations require existing MFA step-up while status remains readable',async()=>{
 const auth=loadTs('worker/production-auth.ts',{'./totp':{totpState:async()=>({enabled:true})}});
 const identity={email:'owner@example.test',stepUpAt:null};
 for(const action of ['connect','connect-lifecycle','update-expiry','revoke','disconnect']){
  const request=new Request('https://management.test/api/apps/boi-ech/cloudflare-preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action})});
  const denied=await auth.productionStepUpGate(request,{},identity);
  assert.equal(denied.status,403);assert.equal((await denied.json()).code,'STEP_UP_REQUIRED');
  assert.equal(await auth.productionStepUpGate(request,{}, {...identity,stepUpAt:Math.floor(Date.now()/1000)}),null);
 }
 assert.equal(await auth.productionStepUpGate(new Request('https://management.test/api/apps/boi-ech/cloudflare-preview',{method:'POST',headers:{'content-type':'application/json'},body:'{"action":"status"}'}),{},identity),null);
});

test('API verifies the signed identity without any localhost signature bypass',async()=>{
 const verified=[];let allowed=false;let invoked=0;
 class PreviewConnectionError extends Error{}
 const route=loadTs('app/api/apps/boi-ech/cloudflare-preview/route.ts',{
  '../../../../control-device.server':{verifyControlProof:async(...args)=>{verified.push(args);if(!allowed)throw new Error('PROOF_REQUIRED');return{role:'owner'};},controlErrorResponse:()=>Response.json({error:'PROOF_REQUIRED'},{status:403})},
  '../../../../cloudflare-preview.server':{PreviewConnectionError,cloudflarePreviewAction:async()=>{invoked++;return{worker:'boi-ech-preview'};}},
 });
 const request=()=>new Request('http://localhost/api/apps/boi-ech/cloudflare-preview',{method:'POST',body:'{"action":"status"}'});
 assert.equal((await route.POST(request())).status,403);assert.equal(invoked,0);assert.equal(verified[0].length,1);
 allowed=true;const response=await route.POST(request());assert.equal(response.status,200);assert.equal(invoked,1);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal((await response.json()).state.worker,'boi-ech-preview');
});

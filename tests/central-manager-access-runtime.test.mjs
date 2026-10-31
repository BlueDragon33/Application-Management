import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTs} from './helpers/load-ts.mjs';
function fixture(role='owner',ignore=false){
 let configured=false;const writes=[];
 const row=()=>({deviceId:'a'.repeat(64),deviceCode:'BE-AAAA-AAAA-AAAA-AAAA',personRole:'manager',personCode:'SQ101',registrationComplete:true,status:'approved',accessExpired:false,accessGroup:'paid',paymentStatus:'paid_verified',accessExpiresAt:'2030-01-01T00:00:00Z',managementConfigured:configured,managementEnabled:configured});
 const route=loadTs('app/api/apps/boi-ech/access/route.ts',{'../../../../control-device.server':{verifyControlProof:async()=>({role,email:'owner@example.test'}),controlErrorResponse:error=>Response.json({error:error.message},{status:500})},'../../../../boi-ech.server':{issueBoiBrowserBridge:async()=>({baseUrl:'https://boi.test',token:'test-only'})}},{fetch:async(url,init)=>{
  if(init.method==='POST'){assert.equal(url,'https://boi.test/api/control/management-access');const body=JSON.parse(init.body);writes.push(body);if(!ignore)configured=body.enabled;return Response.json({managementEnabled:configured});}
  assert.match(url,/api\/control\/overview/);return Response.json({devices:[row()]});
 }});
 return {writes,async save(enabled=true){const response=await route.POST(new Request('https://management.test/api/apps/boi-ech/access',{method:'POST',body:JSON.stringify({action:'manage-access',operation:'manager-access',deviceId:'a'.repeat(64),expectedPersonCode:'SQ101',expectedStatus:'approved',expectedPaymentStatus:'paid_verified',expectedAccessGroup:'paid',enabled})}));return{status:response.status,...await response.json()};}};
}
test('Owner changes manager permission with independent readback and preserves paid entitlement',async()=>{
 const f=fixture();const result=await f.save();assert.equal(result.status,200);assert.equal(result.verified,true);assert.equal(result.device.managementConfigured,true);assert.equal(result.device.paymentStatus,'paid_verified');assert.equal(result.device.accessExpiresAt,'2030-01-01T00:00:00Z');assert.equal(f.writes[0].expectedPersonCode,'SQ101');
 assert.equal((await f.save(false)).device.managementConfigured,false);
});
test('publisher cannot grant management permission and mismatched readback cannot report success',async()=>{
 const denied=fixture('publisher');assert.equal((await denied.save()).status,403);assert.equal(denied.writes.length,0);
 const failed=await fixture('owner',true).save();assert.equal(failed.status,502);assert.notEqual(failed.verified,true);
});

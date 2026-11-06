import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { loadTs } from './helpers/load-ts.mjs';

const account='f88a42260814230aa4a151abbfe5659d';
const worker='277ab3dcacd540a0bd7a510788bdef8c';
const permission='7e79ec33834341f28dd431ab73884400';
const lifecyclePermission='5bc3f8b21c554832afc660159ab75fa4';
const deploy='deployment-fixture-secret';
const lifecycle='lifecycle-fixture-secret';
function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(fs.readFileSync('drizzle/0007_deploy_ops_credentials.sql','utf8'));
 db.exec('CREATE TABLE control_audit_log(actor TEXT,action TEXT,target TEXT,detail_json TEXT)');
 const database={prepare(sql){return{bind(...args){return{first:async()=>db.prepare(sql).get(...args)??null,run:async()=>db.prepare(sql).run(...args)};}};}};
 const meta={id:'a'.repeat(32),name:'boiech-preview-work-fixture',status:'active',expires_on:new Date(Date.now()+30*86400000).toISOString(),not_before:null,condition:{},policies:[{effect:'allow',permission_groups:[{id:permission}],resources:{[`com.cloudflare.api.account.${account}`]:{[`com.cloudflare.edge.worker.script.${worker}`]:'*'}}}]};
 const calls=[];let removed=false;let ignoreWrite=false;let absentReadback=false;let writeFailure='';
 const adminPolicy={effect:'allow',permission_groups:[{id:lifecyclePermission,name:'Account API Tokens Write'}],resources:{[`com.cloudflare.api.account.${account}`]:'*'}};
 const api=loadTs('app/cloudflare-preview.server.ts',{'./control-device.server':{getControlDatabase:async()=>database}},{process:{env:{MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY:'A'.repeat(43)}},fetch:async(url,init)=>{
  calls.push({url,method:init.method??'GET',body:init.body&&JSON.parse(init.body)});
  const key=init.headers.authorization.replace('Bearer ','');
  assert.ok(url.startsWith(`https://api.cloudflare.com/client/v4/accounts/${account}/`));
  if(url.endsWith('/tokens/verify'))return Response.json({success:true,result:{id:key===deploy?meta.id:'b'.repeat(32),status:removed&&key===deploy?'expired':'active',expires_on:meta.expires_on}});
  if(url.endsWith('/workers/scripts/boi-ech-preview/settings')){assert.equal(key,deploy);return Response.json({success:true,result:{}});}
  assert.equal(key,lifecycle);
  if(url.endsWith(`/tokens/${'b'.repeat(32)}`))return Response.json({success:true,result:{id:'b'.repeat(32),policies:[adminPolicy]}});
  assert.equal(url,`https://api.cloudflare.com/client/v4/accounts/${account}/tokens/${meta.id}`);
  if(init.method==='DELETE'||init.method==='PUT'){
   if(init.method==='DELETE')removed=true;else if(!ignoreWrite)meta.expires_on=JSON.parse(init.body).expires_on;
   if(writeFailure==='transport')throw new TypeError('Lost provider response');
   if(writeFailure==='json')return new Response('broken JSON');
   return Response.json({success:true,result:structuredClone(meta)});
  }
  if(removed&&!absentReadback)return Response.json({success:false},{status:404});
  return Response.json({success:true,result:structuredClone(meta)});
 }});
 const action=(payload,role='owner')=>api.cloudflarePreviewAction(payload,{role,email:'owner@example.test'});
 return {db,meta,adminPolicy,calls,action,async connect(){await action({action:'connect-lifecycle',credential:lifecycle});return action({action:'connect',credential:deploy});},ignore(){ignoreWrite=true;},failWrite(kind){writeFailure=kind;},badAbsence(){absentReadback=true;},rows:()=>db.prepare('SELECT * FROM deploy_ops_credentials').all(),audit:()=>db.prepare('SELECT * FROM control_audit_log').all()};
}
test('new connection uses real vault encryption and exposes only safe provider metadata',async()=>{
 const f=fixture();try{await assert.rejects(f.action({action:'connect',credential:deploy}),{code:'LIFECYCLE_AUTHORITY_REQUIRED'});assert.equal(f.rows().length,0);const live=await f.connect();assert.equal(live.lifecycle.ready,true);assert.equal(live.deployment.scopeVerified,true);assert.ok(f.rows().every(r=>!JSON.stringify(r).includes(deploy)));assert.doesNotMatch(JSON.stringify([live,f.audit()]),new RegExp(`${deploy}|${lifecycle}`));}finally{f.db.close();}
});
test('non-Owner cannot read credentials, connect, extend or revoke',async()=>{
 const f=fixture();try{for(const action of ['status','connect','connect-lifecycle','update-expiry','revoke','disconnect'])await assert.rejects(f.action({action,credential:deploy},'publisher'),{code:'OWNER_REQUIRED'});assert.equal(f.calls.length,0);assert.equal(f.rows().length,0);}finally{f.db.close();}
});
test('expiry and revoke remain BLOCKED without lifecycle authority',async()=>{
 const f=fixture();try{await assert.rejects(f.action({action:'update-expiry',expiresOn:new Date(Date.now()+60*86400000).toISOString(),expectedExpiresOn:f.meta.expires_on}),{code:'LIFECYCLE_AUTHORITY_REQUIRED'});await assert.rejects(f.action({action:'revoke',confirmation:f.meta.name}),{code:'LIFECYCLE_AUTHORITY_REQUIRED'});assert.equal(f.calls.filter(c=>c.method==='PUT'||c.method==='DELETE').length,0);}finally{f.db.close();}
});
test('scope widening or another Worker is rejected before lifecycle writes',async()=>{
 const f=fixture();try{await f.connect();for(const resources of [{[`com.cloudflare.api.account.${account}`]:'*'},{[`com.cloudflare.api.account.${account}`]:{'com.cloudflare.edge.worker.script.other':'*'}}]){f.meta.policies[0].resources=resources;await assert.rejects(f.action({action:'update-expiry',expiresOn:new Date(Date.now()+60*86400000).toISOString(),expectedExpiresOn:f.meta.expires_on}),{code:'PREVIEW_TOKEN_SCOPE_MISMATCH'});}assert.equal(f.calls.filter(c=>c.method==='PUT').length,0);}finally{f.db.close();}
});
test('expiry update preserves exact policies/name/conditions and verifies independent readback',async()=>{
 const f=fixture();try{await f.connect();const before=structuredClone(f.meta);const expiresOn=new Date(Date.now()+60*86400000).toISOString();const s=await f.action({action:'update-expiry',expiresOn,expectedExpiresOn:before.expires_on});assert.equal(s.verified,true);assert.equal(s.deployment.expiresOn,expiresOn);const write=f.calls.find(c=>c.method==='PUT');assert.deepEqual(write.body,{name:before.name,policies:before.policies,condition:before.condition,not_before:before.not_before,expires_on:expiresOn});assert.equal(f.calls.at(-1).method,'GET');}finally{f.db.close();}
});
test('stale expiry, invalid date and provider readback mismatch never report success',async()=>{
 const f=fixture();try{await f.connect();for(const expiresOn of ['invalid',new Date(Date.now()-1000).toISOString(),new Date(Date.now()+366*86400000).toISOString()])await assert.rejects(f.action({action:'update-expiry',expiresOn,expectedExpiresOn:f.meta.expires_on}),{code:'INVALID_PREVIEW_EXPIRY'});await assert.rejects(f.action({action:'update-expiry',expiresOn:new Date(Date.now()+60*86400000).toISOString(),expectedExpiresOn:'stale'}),{code:'PREVIEW_TOKEN_CHANGED'});assert.equal(f.calls.filter(c=>c.method==='PUT').length,0);f.ignore();await assert.rejects(f.action({action:'update-expiry',expiresOn:new Date(Date.now()+60*86400000).toISOString(),expectedExpiresOn:f.meta.expires_on}),{code:'PREVIEW_READBACK_MISMATCH',applied:true});}finally{f.db.close();}
});
test('revocation requires typed exact name and verified provider absence before clearing vault',async()=>{
 const f=fixture();try{await f.connect();await assert.rejects(f.action({action:'revoke',confirmation:'boi-ech'}),{code:'PREVIEW_CONFIRMATION_REQUIRED'});assert.equal(f.calls.filter(c=>c.method==='DELETE').length,0);const s=await f.action({action:'revoke',confirmation:f.meta.name,expectedExpiresOn:f.meta.expires_on});assert.equal(s.revoked,true);assert.equal(s.verified,true);assert.equal(f.rows().length,0);}finally{f.db.close();}
});
test('revocation without absence readback retains vault and reports applied/unverified',async()=>{
 const f=fixture();try{await f.connect();f.badAbsence();await assert.rejects(f.action({action:'revoke',confirmation:f.meta.name,expectedExpiresOn:f.meta.expires_on}),{code:'PREVIEW_READBACK_MISMATCH',applied:true});assert.equal(f.rows().length,2);}finally{f.db.close();}
});
test('expired connection remains replaceable in the Owner UI while lifecycle is BLOCKED',async()=>{
 const f=fixture();try{await f.connect();f.meta.expires_on=new Date(Date.now()-1000).toISOString();const s=await f.action({action:'status'});assert.equal(s.encryptionReady,true);assert.equal(s.lifecycle.ready,false);assert.equal(s.deployment.connected,false);assert.match(s.blocker,/hiệu lực|hết hạn/i);}finally{f.db.close();}
});
test('read-only or account-wide lifecycle token cannot make expiry controls ready',async()=>{
 const f=fixture();try{f.adminPolicy.permission_groups[0]={id:'d'.repeat(32),name:'Account API Tokens Read'};await assert.rejects(f.action({action:'connect-lifecycle',credential:lifecycle}),{code:'LIFECYCLE_AUTHORITY_REQUIRED'});f.adminPolicy.permission_groups[0]={id:lifecyclePermission,name:'Account API Tokens Write'};f.adminPolicy.resources={'com.cloudflare.api.account.*':'*'};await assert.rejects(f.action({action:'connect-lifecycle',credential:lifecycle}),{code:'LIFECYCLE_AUTHORITY_REQUIRED'});assert.equal(f.rows().length,0);}finally{f.db.close();}
});
test('lost or malformed PUT and DELETE responses are reconciled using independent provider state',async()=>{
 for(const method of ['PUT','DELETE'])for(const kind of ['transport','json']){const f=fixture();try{await f.connect();f.failWrite(kind);const result=await f.action(method==='PUT'?{action:'update-expiry',expiresOn:new Date(Date.now()+60*86400000).toISOString(),expectedExpiresOn:f.meta.expires_on}:{action:'revoke',confirmation:f.meta.name,expectedExpiresOn:f.meta.expires_on});assert.equal(result.verified,true);if(method==='DELETE')assert.equal(result.revoked,true);}finally{f.db.close();}}
});
test('unresolved transport failure is reported as unknown application, never false',async()=>{
 const f=fixture();try{await f.connect();f.ignore();f.failWrite('transport');await assert.rejects(f.action({action:'update-expiry',expiresOn:new Date(Date.now()+60*86400000).toISOString(),expectedExpiresOn:f.meta.expires_on}),{code:'PREVIEW_READBACK_MISMATCH',applied:null});}finally{f.db.close();}
});
test('corrupted encrypted vault returns safe recovery metadata and can be disconnected',async()=>{
 const f=fixture();try{await f.connect();f.db.exec("UPDATE deploy_ops_credentials SET credential_ciphertext='corrupted'");const s=await f.action({action:'status'});assert.equal(s.encryptionReady,true);assert.equal(s.vaultPresent,true);assert.equal(s.lifecycle.ready,false);assert.match(s.blocker,/mã hóa|lưu/i);assert.equal((await f.action({action:'disconnect'})).vaultPresent,false);assert.equal(f.rows().length,0);}finally{f.db.close();}
});
test('account-wide deployment credentials are never staged in the vault',async()=>{
 const f=fixture();try{await f.action({action:'connect-lifecycle',credential:lifecycle});f.meta.policies[0].resources={[`com.cloudflare.api.account.${account}`]:'*'};await assert.rejects(f.action({action:'connect',credential:deploy}),{code:'PREVIEW_TOKEN_SCOPE_MISMATCH'});assert.equal(f.rows().length,1);}finally{f.db.close();}
});
test('provider metadata may omit the optional permission name while the exact Write ID remains authoritative',async()=>{
 const f=fixture();try{delete f.adminPolicy.permission_groups[0].name;assert.equal((await f.action({action:'connect-lifecycle',credential:lifecycle})).lifecycle.configured,true);}finally{f.db.close();}
});

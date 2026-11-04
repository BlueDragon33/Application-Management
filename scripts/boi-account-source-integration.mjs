// Explicit two-checkout LOCAL fixture; not a hosted-D1 or browser acceptance test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {loadTs} from '../tests/helpers/load-ts.mjs';
const boi=path.resolve(process.argv[2]??'../boi-account-first');
const pinned='040898b77b7ede9541e5f0c616656a5aa3ef20a4';
// Later handoff-only commits are allowed; every owning application byte stays pinned.
execFileSync('git',['merge-base','--is-ancestor',pinned,'HEAD'],{cwd:boi});
execFileSync('git',['diff','--exit-code',pinned,'--','boi-ech'],{cwd:boi});
const sqlite=new DatabaseSync(':memory:');
const migrations=path.join(boi,'boi-ech/drizzle');
for(const file of fs.readdirSync(migrations).filter(n=>n.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(path.join(migrations,file),'utf8'));
sqlite.exec('PRAGMA foreign_keys=ON');
// Fresh DDL deliberately has no policy row; seed a synthetic existing app policy.
sqlite.exec("INSERT INTO access_automation_settings(id,auto_confirm_new_devices,default_access_days) VALUES('global',0,90)");
function prepare(sql){let args=[];return{bind(...values){args=values;return this},async first(){return sqlite.prepare(sql).get(...args)??null},async all(){return{results:sqlite.prepare(sql).all(...args)}},async run(){return{meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}}},_run(){const s=sqlite.prepare(sql);return s.columns().length?{results:s.all(...args),meta:{changes:0}}:{meta:{changes:Number(s.run(...args).changes)}}}}}
const db={prepare,async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>s._run());sqlite.exec('COMMIT');return result}catch(error){sqlite.exec('ROLLBACK');throw error}}};
const secret='local-only-integration-secret-'.repeat(2),centralOrigin='https://central.fixture.test',boiOrigin='https://boi.fixture.test';
// Platform bindings and transport are synthetic; crypto, route, source service, SQL,
// signed-ticket verification and consumer read-command-independent-read are actual code.
class DeviceAccessError extends Error{constructor(message,status,code){super(message);this.status=status;this.code=code}}
const deviceBindings={DeviceAccessError,getCourseDatabase:async()=>db};
const sourceOverrides={'cloudflare:workers':{env:{BOI_ECH_ACCOUNT_FIRST:'true',BOI_ECH_ACCOUNT_ORIGIN:boiOrigin,CONTROL_SERVICE_SECRET:secret,APPLICATION_MANAGEMENT_ORIGIN:centralOrigin}},'next/headers':{cookies:async()=>({get:()=>null}),headers:async()=>new Headers()},'./device-auth.server':deviceBindings};
const source=loadTs(path.join(boi,'boi-ech/app/account-core.server.ts'));
const route=loadTs(path.join(boi,'boi-ech/app/api/control/accounts/route.ts'),sourceOverrides);
const service=new source.AccountService(db);
const {accountPermissionOperation}=loadTs('app/boi-account-permissions.server.ts');
const central=loadTs('app/boi-ech.server.ts',{'./client-origin.server':{resolveClientBridge:async()=>({baseUrl:boiOrigin,secret,source:'synthetic-only'})}});
const oldFetch=globalThis.fetch;
let fetches=0;
globalThis.fetch=async url=>{fetches++;assert.equal(url,boiOrigin+'/api/control/runtime');return Response.json({applicationId:'boi-ech',repository:'BlueDragon33/BOIECH_AI',runtime:'boi-ech',controlContract:'application-management',controlGeneration:2,sourceTrack:'main'})};
const calls=[];
try{
 const owner=await central.issueBoiBrowserBridge('owner@fixture.test','owner');
 const publisher=await central.issueBoiBrowserBridge('publisher@fixture.test','publisher');
 const invokeWith=token=>async body=>{calls.push(body.action);const response=await route.POST(new Request(boiOrigin+'/api/control/accounts',{method:'POST',headers:{origin:centralOrigin,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)}));const result=await response.json();if(!response.ok)throw new Error(result.code??'HTTP_'+response.status);return result};
 const invoke=invokeWith(owner.token);
 const publicKey=await crypto.subtle.exportKey('jwk',(await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])).publicKey);
 const registration=(n,role)=>({login:'fixture'+n,password:'Local-only secret phrase '+n,role,personCode:'FIXTURE'+n,phone:'090'+String(n).padStart(7,'0'),familyName:'Synthetic',givenName:'Person',className:'Local',privacyAccepted:true,publicKey});
 const manager=await service.register(registration(100,'manager'),'manager-local');
 const learner=await service.register(registration(1,'learner'),'learner-local');
 const id=manager.account.accountId;
 const list=await accountPermissionOperation('owner',{operation:'list'},invoke);
 assert.equal(list.accounts.length,1);
 calls.length=0;
 const approval=await accountPermissionOperation('owner',{operation:'approve-manager',accountId:id,expectedRevision:0},invoke);
 assert.deepEqual(calls,['read','command','read']);assert.equal(approval.account.status,'approved');
 assert.ok(!approval.account.permissions.some(p=>p.scope==='registrants.read.all'));
 await service.review(manager.token,learner.account.accountId,'approve');
 const other=await service.login({...registration(1,'learner'),publicKey:await crypto.subtle.exportKey('jwk',(await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])).publicKey)},'second-device');
 assert.equal((await service.authorize(other.token,true)).accountId,learner.account.accountId);
 assert.equal((await service.reviewBoard(manager.token)).quotas.learner.used,1);
 await assert.rejects(()=>service.readRegistrants(manager.token,'support',0,10),/PERMISSION/);
 await assert.rejects(()=>invokeWith(publisher.token)({action:'list'}),/OWNER/);
 const before=sqlite.prepare('SELECT count(*) n FROM account_audit').get().n;
 await assert.rejects(()=>accountPermissionOperation('publisher',{operation:'read-all'},invoke),/OWNER/);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM account_audit').get().n,before);
 const grant=await accountPermissionOperation('owner',{operation:'read-all',accountId:id,expectedRevision:1,enabled:true,expiresAt:Date.now()+60000},invoke);
 assert.equal(grant.account.revision,2);
 await assert.rejects(()=>accountPermissionOperation('owner',{operation:'read-all',accountId:id,expectedRevision:1,enabled:false},invoke),/CAS/);
 const rows=await service.readRegistrants(manager.token,'Synthetic support receipt',0,10);
 assert.ok(rows.accounts.some(r=>r.accountId===learner.account.accountId));
 assert.doesNotMatch(JSON.stringify(rows),/password|verifier|token|public_key|recovery/i);
 assert.equal(sqlite.prepare("SELECT count(*) n FROM account_audit WHERE action='registrants.read.all'").get().n,rows.accounts.length);
 await accountPermissionOperation('owner',{operation:'read-all',accountId:id,expectedRevision:2,enabled:false},invoke);
 await assert.rejects(()=>service.readRegistrants(manager.token,'support',0,10),/PERMISSION/);
 await assert.rejects(()=>invokeWith(owner.token+'tamper')({action:'list'}),/TICKET/);
 console.log(JSON.stringify({result:'LOCAL_SOURCE_INTEGRATION_PASS',boiSource:pinned,migrations:fs.readdirSync(migrations).filter(n=>n.endsWith('.sql')).length,checks:['actual signed Owner ticket accepted','signed Publisher denied','consumer publisher cannot invoke','read-command-independent-read','account CAS stale denied','manager approval separate from broad read','one account on second device without reapproval','shared quota counts account once','broad read per-target audit and redaction','immediate revoke','tampered ticket denied'],syntheticRuntimeIdentityProbes:fetches,limitations:['platform bindings mocked','HTTP in-process','SQLite not live D1','no browser/runtime-target acceptance']},null,2));
}finally{globalThis.fetch=oldFetch;sqlite.close()}

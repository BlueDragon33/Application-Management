import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {loadTs} from './helpers/load-ts.mjs';

class AdminApiError extends Error {constructor(message,data){super(message);this.data=data;}}
const manager={accountId:'acc_'+'1'.repeat(64),name:'Cán bộ mẫu',status:'pending',accountRevision:1,onboardingRevision:1,onboardingStage:'requested'};
const accounts=[{accountId:manager.accountId,name:'Cán bộ mẫu',role:'manager',deviceStatus:'approved',onboardingStage:'active',entitlement:{state:'active',active:true,revision:2,expiresAt:'2027-01-01T00:00:00Z',activatedAt:'2026-11-01T00:00:00Z'}}];
const policy={role:'manager',defaultDays:30,revision:1,updatedAt:'2026-11-01'};
const defaults={loadBoiAccountDurations:async()=>({accounts,policies:[policy]}),loadBoiManagerInbox:async()=>({managers:[manager],nextCursor:null}),issueBoiManagerInvitation:async()=>({inviteUrl:'http://localhost/invite/mock',expiresAt:'2027-01-01'}),reviewBoiManagerAccount:async()=>({}),changeBoiAccountDuration:async()=>({}),changeBoiDefaultAccountDays:async()=>({}),cancelBoiLocalTestManager:async()=>({})};
async function mount(t,component,api={}){
 const oldFlag=process.env.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW;
 process.env.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW='true';
 t.after(()=>{if(oldFlag===undefined)delete process.env.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW;else process.env.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW=oldFlag;});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost:3000'});
 const names=['window','document','HTMLElement','IS_REACT_ACT_ENVIRONMENT'];const old=Object.fromEntries(names.map(k=>[k,globalThis[k]]));
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 window.confirm=()=>true;window.prompt=()=>'';
 const Auth=({finish})=>React.createElement('div',{role:'dialog','aria-label':'Xác minh Authenticator'},React.createElement('button',{onClick:()=>finish(true)},'Xác minh thử nghiệm'),React.createElement('button',{onClick:()=>finish(false)},'Hủy xác minh'));
 const View=loadTs(`app/apps/boi-ech/${component}.tsx`,{'../../boi-access-client':{...defaults,...api},'../../admin-device-client':{AdminApiError},'../../authenticator-step-up':{__esModule:true,default:Auth}}).default;
 const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));
 t.after(async()=>{await act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,old);});
 await act(async()=>root.render(React.createElement(View,component==='boi-owner-overview'?{onNavigate:()=>{}}:{})));
 const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes(text));
 return{button,click:async text=>{assert.ok(button(text),`missing ${text}`);await act(async()=>button(text).click());}};
}

test('Owner overview uses one-review language and does not count legacy final-review rows as new approvals',async t=>{
 await mount(t,'boi-owner-overview',{loadBoiManagerInbox:async()=>({managers:[manager,{...manager,accountId:'acc_'+'2'.repeat(64),onboardingStage:'profile_review'}],nextCursor:null})});
 assert.doesNotMatch(document.body.textContent,/duyệt hai vòng|duyệt vòng hai|duyệt vòng một/i);
 const metric=[...document.querySelectorAll('.boi-account-metrics article')].find(a=>a.textContent.includes('Cán bộ chờ duyệt'));
 assert.equal(metric.querySelector('strong').textContent,'1');
});
test('refresh invalidates old Owner metrics immediately while the replacement request is unresolved',async t=>{
 let calls=0,finish;
 const f=await mount(t,'boi-owner-overview',{loadBoiAccountDurations:async()=>++calls===1?{accounts,policies:[policy]}:await new Promise(r=>finish=r)});
 await f.click('Đồng bộ dữ liệu');
 assert.ok([...document.querySelectorAll('.boi-account-metrics strong')].every(x=>x.textContent==='—'));
 await act(async()=>finish({accounts:[],policies:[policy]}));
});
test('failed refresh shows unverified state rather than a verified empty queue',async t=>{
 const f=await mount(t,'boi-owner-overview',{loadBoiManagerInbox:async()=>{throw new Error('Mất kết nối kiểm thử');}});
 assert.match(document.querySelector('[role="alert"]').textContent,/Mất kết nối/);
 assert.doesNotMatch(document.body.textContent,/Không có hồ sơ cán bộ cần duyệt/);
 assert.ok(f.button('Đồng bộ dữ liệu'));
});
test('manager approval opens inline MFA and retries exactly once after verification with the original CAS revision',async t=>{
 const calls=[];
 const f=await mount(t,'account-expiry-panel',{reviewBoiManagerAccount:async(...args)=>{calls.push(args);if(calls.length===1)throw new AdminApiError('MFA',{code:'STEP_UP_REQUIRED'});return{};}});
 await f.click('Duyệt tài khoản');
 assert.ok(document.querySelector('[role="dialog"]'));
 await f.click('Xác minh thử nghiệm');
 assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);assert.equal(calls[1][2],1);
 assert.match(document.body.textContent,/đã xác minh và đọc lại/i);
});
test('cancelling inline MFA preserves the manager request and never retries the write',async t=>{
 let calls=0;
 const f=await mount(t,'account-expiry-panel',{reviewBoiManagerAccount:async()=>{calls++;throw new AdminApiError('MFA',{code:'STEP_UP_REQUIRED'});}});
 await f.click('Duyệt tài khoản');await f.click('Hủy xác minh');
 assert.equal(calls,1);assert.doesNotMatch(document.body.textContent,/đã xác minh và đọc lại/i);
 assert.match(document.body.textContent,/hủy xác minh/i);
});
test('409 and an uncertain applied write never trigger MFA retry or claim success',async t=>{
 let calls=0;
 const f=await mount(t,'account-expiry-panel',{reviewBoiManagerAccount:async()=>{calls++;throw new AdminApiError('Dữ liệu đã thay đổi; đọc lại hồ sơ',{code:'CAS_CONFLICT',applied:null});}});
 await f.click('Duyệt tài khoản');assert.equal(calls,1);assert.equal(document.querySelector('[role="dialog"]'),null);
 assert.match(document.body.textContent,/Dữ liệu đã thay đổi/);assert.doesNotMatch(document.body.textContent,/đã xác minh và đọc lại/i);
});
test('single-review confirmation does not promise a second approval or early activation',async t=>{
 const messages=[];const f=await mount(t,'account-expiry-panel');window.confirm=message=>{messages.push(message);return false;};
 await f.click('Duyệt tài khoản');assert.doesNotMatch(messages.join(' '),/vòng một|vòng hai|vòng 1|vòng 2/i);
 assert.match(messages[0],/hoàn thiện hồ sơ/i);
});
test('account client preserves structured MFA and uncertain-write information for the Owner UI',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({ok:false,error:'Xác minh MFA',code:'STEP_UP_REQUIRED',applied:false},{status:403});
 try{
  const client=loadTs('app/boi-access-client.ts',{'./admin-device-client':{connectAdminCenter:async()=>({access:{status:'approved',role:'owner',deviceId:'production-session:fixture'}})}});
  await assert.rejects(client.changeBoiDefaultAccountDays({role:'manager',defaultDays:30,expectedRevision:1,reason:'Kiểm thử MFA'}),e=>e.data?.code==='STEP_UP_REQUIRED'&&e.data.applied===false);
 }finally{globalThis.fetch=previous;}
});

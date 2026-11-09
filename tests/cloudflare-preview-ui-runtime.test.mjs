import assert from 'node:assert/strict';
import test from 'node:test';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {loadTs} from './helpers/load-ts.mjs';

const blank={worker:'boi-ech-preview',encryptionReady:true,deployment:{connected:false,scopeVerified:false},lifecycle:{configured:true,ready:false},blocker:'BLOCKED: chưa cấp quyền lifecycle'};
async function mount(t,request){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://management.test'});
 const keys=['window','document','HTMLElement','IS_REACT_ACT_ENVIRONMENT'];const old=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));
 t.after(async()=>{await act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,old);});
 class AdminApiError extends Error{}
 const View=loadTs('app/apps/boi-ech/cloudflare-preview/connection.tsx',{'../../../admin-device-client':{cloudflarePreviewAdminAction:request,AdminApiError},'next/link':{__esModule:true,default:({children,...p})=>React.createElement('a',p,children)}}).default;
 await act(async()=>root.render(React.createElement(View)));
 const button=text=>[...document.querySelectorAll('button')].find(x=>x.textContent===text);
 const input=async(id,value)=>act(async()=>{const el=document.getElementById(id);el.value=value;el.dispatchEvent(new window.Event('input',{bubbles:true}));});
 return {button,input,submit:async id=>act(async()=>document.getElementById(id).dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})))};
}
test('UI defaults to 30 days and disables lifecycle mutations when authority is BLOCKED',async t=>{
 const f=await mount(t,async()=>({ok:true,state:blank}));
 assert.ok(f.button('30 ngày từ hôm nay'));
 assert.equal(document.getElementById('preview-expiry').value,new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+30*86400000)));
 assert.equal(f.button('Lưu ngày hết hạn').disabled,true);assert.equal(f.button('Thu hồi token Preview').disabled,true);
 assert.match(document.querySelector('[role="status"]').textContent,/BLOCKED/);
 assert.ok([...document.querySelectorAll('a[href="/apps/boi-ech"]')].some(a=>a.textContent==='Quản lý thời hạn và quyền manager'));
});
test('password submission is serialized and clears the draft only after saved readback',async t=>{
 const calls=[];let finish;const pending=new Promise(r=>finish=r);
 const f=await mount(t,async p=>{calls.push(p);if(p.action==='status')return{ok:true,state:blank};await pending;return{ok:true,state:{...blank,deployment:{connected:true,scopeVerified:false,expiresOn:new Date(Date.now()+30*86400000).toISOString()}}};});
 assert.equal(document.getElementById('preview-deploy-token').type,'password');await f.input('preview-deploy-token','fixture-token');
 act(()=>{document.getElementById('preview-connect-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));document.getElementById('preview-connect-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));});
 assert.equal(calls.filter(p=>p.action==='connect').length,1);assert.equal(f.button('Kết nối token Preview').disabled,true);
 await act(async()=>finish());assert.equal(document.getElementById('preview-deploy-token').value,'');assert.doesNotMatch(document.body.textContent,/fixture-token/);
});
test('failed mutation keeps draft and never announces a verified success',async t=>{
 const f=await mount(t,async p=>{if(p.action==='status')return{ok:true,state:blank};throw new Error('Cloudflare từ chối quyền');});
 await f.input('preview-deploy-token','fixture-token');await f.submit('preview-connect-form');
 assert.equal(document.getElementById('preview-deploy-token').value,'fixture-token');assert.match(document.querySelector('[role="alert"]').textContent,/từ chối/);assert.doesNotMatch(document.body.textContent,/Đã lưu và xác minh/);
});
test('corrupt stored vault keeps the authenticated disconnect recovery control usable',async t=>{
 const f=await mount(t,async()=>({ok:true,state:{...blank,vaultPresent:true,lifecycle:{configured:false,ready:false},blocker:'Kho mã hóa chưa mở được'}}));
 assert.equal(f.button('Ngắt kết nối App-Management').disabled,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {webcrypto} from 'node:crypto';
import {JSDOM,VirtualConsole,ResourceLoader} from 'jsdom';

// DOM execution of the emitted file, not a browser/layout acceptance test.
// IndexedDB storage is a test fixture; P-256 operations use Node WebCrypto.
function identityStore(opened){
 let value;
 const request=result=>{const req={result};queueMicrotask(()=>req.onsuccess?.());return req;};
 const db={createObjectStore(){},transaction(){return{objectStore(){return{get:()=>request(value),put:next=>{value=next;return request(next);}};}};}};
 return{open(name){opened.push(name);return request(db);}};
}
async function until(check){
 const end=Date.now()+8000;
 while(Date.now()<end){if(check())return;await new Promise(resolve=>setTimeout(resolve,15));}
 assert.ok(check(),'DOM condition did not resolve');
}
test('emitted Owner review boots actual components with isolated sample identity and no external resource loads',async t=>{
 const out=mkdtempSync(path.join(os.tmpdir(),'owner-export-test-'));
 t.after(()=>rmSync(out,{recursive:true,force:true}));
 execFileSync(process.execPath,['scripts/build-boi-owner-offline.mjs',out],{stdio:'pipe',timeout:60000});
 const html=readFileSync(path.join(out,'MO_GIAO_DIEN_OWNER.html'),'utf8');
 assert.match(html,/connect-src 'none'/);assert.match(html,/worker-src 'none'/);
 assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+href=/i);
 const errors=[],resourceLoads=[],opened=[],vc=new VirtualConsole();
 vc.on('jsdomError',error=>{if(error.type!=='css parsing')errors.push(error.message);});
 class NoNetwork extends ResourceLoader {fetch(url){resourceLoads.push(url);return null;}}
 const dom=new JSDOM(html,{url:'https://offline-app.invalid',runScripts:'dangerously',resources:new NoNetwork(),virtualConsole:vc,beforeParse(window){
  Object.assign(window,{Response,Request,TextEncoder,TextDecoder,URLSearchParams,AbortController,structuredClone});
  Object.defineProperty(window.crypto,'subtle',{value:webcrypto.subtle});
  Object.defineProperty(window,'indexedDB',{value:identityStore(opened),configurable:true});
  window.confirm=()=>true;window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  window.fetch=()=>{throw new Error('Native network transport must not run');};
 }});
 t.after(()=>dom.window.close());
 const {document}=dom.window;
 await until(()=>document.body.textContent.includes('Quản trị tài khoản Bơi Ếch'));
 await until(()=>document.querySelectorAll('.boi-account-metrics article').length===5);
 await t.test('review never opens the APP credential namespace',()=>{assert.ok(opened.length>0);assert.ok(opened.every(name=>name==='boi-owner-offline-identity-v1'));});
 assert.match(document.body.textContent,/OFFLINE REVIEW/);
 assert.doesNotMatch(document.body.textContent,/Owner duyệt hai vòng|Duyệt vòng 2/);
 const nav=[...document.querySelectorAll('nav button')].find(b=>b.textContent.includes('Tài khoản & Duyệt cán bộ'));
 assert.ok(nav,'actual Owner navigation exists');nav.click();
 await until(()=>document.querySelector('.boi-manager-inbox'));
 await until(()=>document.body.textContent.includes('Cán bộ đang chờ duyệt'));
 const approve=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Duyệt tài khoản'));
 assert.ok(approve);approve.click();
 await until(()=>document.querySelector('[role="dialog"]'));
 assert.match(document.querySelector('[role="dialog"]').textContent,/Authenticator/);
 const cancel=[...document.querySelectorAll('[role="dialog"] button')].find(b=>/Hủy/.test(b.textContent));
 assert.ok(cancel);cancel.click();
 await until(()=>!document.querySelector('[role="dialog"]'));
 assert.match(document.body.textContent,/hủy xác minh/);
 const devices=[...document.querySelectorAll('nav button')].find(b=>b.textContent.includes('Thiết bị & Tiến độ'));
 assert.ok(devices);devices.click();
 await until(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Xuất CSV')));
 const csv=()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Xuất CSV'));
 assert.equal(csv().disabled,false);
 const fixtureFetch=dom.window.fetch;
 dom.window.fetch=(input,init)=>String(input)==='/api/dashboard'?Promise.resolve(Response.json({error:'Bootstrap unavailable'},{status:503})):fixtureFetch(input,init);
 const refresh=document.querySelector('.boi-sync-button');
 assert.ok(refresh);refresh.click();
 await until(()=>document.body.textContent.includes('Bootstrap unavailable'));
 assert.equal(csv().disabled,true,'bootstrap failure invalidates old registry verification');
 assert.doesNotMatch(document.querySelector('.boi-stats')?.textContent||'',/Tổng thiết bị3/);
 assert.deepEqual(resourceLoads,[]);assert.deepEqual(errors,[]);
});

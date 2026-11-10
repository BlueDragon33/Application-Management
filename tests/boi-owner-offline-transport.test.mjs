import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {loadTs} from './helpers/load-ts.mjs';
test('reset removes armed demo faults so a fresh review never inherits a false 409 or uncertain write',async()=>{
 const dom=new JSDOM('',{url:'https://offline-app.invalid'});
 try{
  const adapter=loadTs('qa/owner-offline-transport.ts',{}, {window:dom.window,localStorage:dom.window.localStorage,Event:dom.window.Event,Request,Response,document:dom.window.document});
  adapter.installOfflineTransport();
  const call=body=>dom.window.fetch('/api/apps/boi-ech/account-entitlements',{method:'POST',body:JSON.stringify(body)});
  for(const fault of ['conflict','uncertain']){
   adapter.lab[fault]();adapter.lab.reset();
   await dom.window.fetch('/__account/mfa/step-up',{method:'POST',body:new URLSearchParams({code:'000000'})});
   const result=await call({action:'set-account',operation:'set-expiry',accountId:'acc_'+'3'.repeat(64),expectedRevision:1,expiresAt:'2030-01-01T00:00:00Z'});
   assert.equal(result.status,200,'reset clears '+fault);
   assert.equal((await result.json()).verified,true);
  }
 }finally{dom.window.close();}
});

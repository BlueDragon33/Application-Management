import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const script=path.join(root,'scripts/prepare-cloudflare-preview.mjs');
const template=fs.readFileSync(path.join(root,'wrangler.cloudflare.example.jsonc'),'utf8');
const previewD1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const productionD1='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const defaults={
 APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID:previewD1,
 APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID:productionD1,
 CONTROL_OWNER_EMAILS:'owner@fixture.invalid',
 BOI_ECH_BASE_URL:'https://boi-ech-preview.example.invalid',
 GITHUB_SHA:'a'.repeat(40)
};
function prepare(override={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'app-preview-preflight-'));
 try{
  fs.writeFileSync(path.join(dir,'wrangler.cloudflare.example.jsonc'),template);
  const result=spawnSync(process.execPath,[script],{cwd:dir,
   env:{PATH:process.env.PATH||'',...defaults,...override},encoding:'utf8',timeout:10_000});
  assert.equal(result.error,undefined);
  const file=path.join(dir,'wrangler.cloudflare.jsonc');
  const exists=fs.existsSync(file);
  return {result,exists,rendered:exists?fs.readFileSync(file,'utf8'):''};
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
test('App Preview materializer retains isolated D1, real configured Owner identity and BOIECH Preview origin without embedding secrets',()=>{
 const {result,exists,rendered}=prepare();
 assert.equal(result.status,0,result.stderr);
 assert.equal(exists,true);
 assert.match(rendered,/"name": "application-management-preview"/);
 assert.ok(rendered.includes('"database_id": "'+previewD1+'"'));
 assert.ok(rendered.includes('"CONTROL_OWNER_EMAILS": "owner@fixture.invalid"'));
 assert.ok(rendered.includes('"BOI_ECH_BASE_URL": "https://boi-ech-preview.example.invalid"'));
 assert.ok(rendered.includes('"APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL": "cloudflare-preview"'));
 assert.equal(rendered.includes(productionD1),false);
 for(const key of ['CONTROL_SERVICE_SECRET','APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET','MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY']){
  assert.equal(rendered.includes(key),false,'protected Worker secrets must never appear in public config: '+key);
 }
});
test('App Preview materializer rejects invalid and colliding database IDs, invalid Owner and non-HTTPS bridge',()=>{
 const cases=[
  {APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID:productionD1},
  {APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID:'00000000-0000-0000-0000-000000000003'},
  {APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID:'1cf8f6b4-6c23-4479-8751-47703ecac92b'},
  {CONTROL_OWNER_EMAILS:''},
  {CONTROL_OWNER_EMAILS:'not-an-email'},
  {BOI_ECH_BASE_URL:'http://localhost:3004'},
  {BOI_ECH_BASE_URL:'https://example.chatgpt.site'}
 ];
 for(const overrides of cases){
  const {result,exists}=prepare(overrides);
  assert.notEqual(result.status,0,'invalid Preview materialization must fail closed: '+JSON.stringify(overrides));
  assert.equal(exists,false,'no Preview config on any invalid security boundary');
 }
});

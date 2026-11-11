import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as launcher from '../scripts/windows/START_APP_OWNER_OFFLINE.mjs';
const {validateManifest,candidatePath,cleanRuntimeEnvironment,parseArgs}=launcher;
const sha='1'.repeat(40);
test('offline launcher only accepts the exact APP repository and a frozen SHA',()=>{
 assert.equal(validateManifest({repository:'BlueDragon33/Application-Management',sha}).sha,sha);
 assert.throws(()=>validateManifest({repository:'BlueDragon33/BOIECH_AI',sha}));
 assert.throws(()=>validateManifest({repository:'BlueDragon33/Application-Management',sha:'main'}));
});
test('review checkout lives outside both original repositories',()=>{
 const p=candidatePath('/workspace/local',sha);assert.match(p,/_app-owner-review/);assert.ok(!p.includes('/Application-Management/'));assert.ok(!p.includes('/BOIECH_AI/'));
});
test('local runtime removes provider credentials and Production origins while preserving supplied proxy trust',()=>{
 const env=cleanRuntimeEnvironment({PATH:'/bin',HTTPS_PROXY:'http://proxy:8080',NODE_EXTRA_CA_CERTS:'/trust/ca.pem',CLOUDFLARE_API_TOKEN:'secret',VERCEL_TOKEN:'secret',GOOGLE_OAUTH_CLIENT_SECRET:'secret',CONTROL_SERVICE_SECRET:'secret',BOI_ECH_BASE_URL:'https://production.example'});
 assert.equal(env.CLOUDFLARE_API_TOKEN,undefined);assert.equal(env.CONTROL_SERVICE_SECRET,undefined);assert.equal(env.BOI_ECH_BASE_URL,undefined);assert.equal(env.GOOGLE_OAUTH_CLIENT_SECRET,undefined);
 assert.equal(env.HTTPS_PROXY,'http://proxy:8080');assert.equal(env.NODE_EXTRA_CA_CERTS,'/trust/ca.pem');assert.equal(env.CONTROL_PLANE_NETWORK_MODE,'local');
});
test('argument errors fail before any process or source mutation',()=>{
 assert.throws(()=>parseArgs(['--start','--prepare-start']));assert.throws(()=>parseArgs(['--start','--workspace']));assert.throws(()=>parseArgs(['--publish']));
 assert.equal(parseArgs(['--start','--workspace','/tmp/review','--no-browser']).mode,'--start');
});
test('ignored runtime credentials are rejected rather than inherited or overwritten',()=>{
 const root=mkdtempSync(path.join(os.tmpdir(),'owner-env-'));
 try{
  assert.equal(typeof launcher.ensureLocalRuntimeFiles,'function');
  launcher.ensureLocalRuntimeFiles(root);
  assert.match(readFileSync(path.join(root,'.dev.vars'),'utf8'),/owner-review@localhost.invalid/);
  launcher.ensureLocalRuntimeFiles(root);
  writeFileSync(path.join(root,'.dev.vars'),'CONTROL_SERVICE_SECRET=do-not-load\n');
  assert.throws(()=>launcher.ensureLocalRuntimeFiles(root),/runtime|\.dev.vars/i);
  assert.equal(readFileSync(path.join(root,'.dev.vars'),'utf8'),'CONTROL_SERVICE_SECRET=do-not-load\n');
  rmSync(path.join(root,'.dev.vars'));
  writeFileSync(path.join(root,'.env.local'),'CLOUDFLARE_API_TOKEN=do-not-load\n');
  assert.throws(()=>launcher.ensureLocalRuntimeFiles(root),/\.env/i);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('launcher code contains only local migrations, no main switch, reset, remote publish or paired BOI commands',()=>{
 const s=readFileSync('scripts/windows/START_APP_OWNER_OFFLINE.mjs','utf8');
 assert.match(s,/'migrations','apply','learning-management-db','--local'/);
 assert.match(s,/'worktree','add','--detach'/);
 assert.doesNotMatch(s,/'--remote'|'deploy'|'reset'|'switch'|'merge'|git\([^\n]*BOIECH_AI/);
});

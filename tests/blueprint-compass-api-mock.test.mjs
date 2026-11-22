import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as core from '../app/blueprint-compass-core.mjs';

const require = createRequire(import.meta.url);
const typescript = require('typescript');
const API = fs.readFileSync(new URL('../app/api/tools/blueprint-compass/route.ts', import.meta.url), 'utf8');
const SHAMAIN='a'.repeat(40), SHAPR='b'.repeat(40), REPO='BlueDragon33/Application-Management';

function prepare({authenticated=true,upstream='ok',overrides={}}={}) {
  let requests=[];
  const fetchStub=async(url,options={})=> {
    requests.push({url,method:options.method,redirect:options.redirect,hasAuthorization:!!options.headers?.Authorization});
    if(upstream!=='ok')return new Response('unavailable',{status:upstream==='forbidden'?403:503});
    let data;
    if(url===`https://api.github.com/repos/${REPO}`) data=overrides.metadata ?? {full_name:REPO,default_branch:'main'};
    else if(url.includes('/pulls?')) data=[{number:7,title:'Ready',html_url:`https://github.com/${REPO}/pull/7`,draft:true,head:{sha:SHAPR},labels:[]}];
    else if(url.includes('/issues?')) data=[{number:8,title:'Review',html_url:`https://github.com/${REPO}/issues/8`,labels:[]},{number:9,title:'Injected',html_url:'https://github.com/BlueDragon33/BOIECH_AI/issues/9',labels:[]}];
    else if(url.endsWith('/commits/main')) data={sha:SHAMAIN};
    else throw new Error(`Unexpected URL: ${url}`);
    if(url.includes('/pulls?') && 'pulls' in overrides) data=overrides.pulls;
    if(url.includes('/issues?') && 'issues' in overrides) data=overrides.issues;
    if(url.endsWith('/commits/main') && 'commit' in overrides) data=overrides.commit;
    return Response.json(data);
  };
  const transpiled=typescript.transpileModule(API,{compilerOptions:{target:typescript.ScriptTarget.ES2022,module:typescript.ModuleKind.CommonJS,strict:true},reportDiagnostics:true});
  const errors=(transpiled.diagnostics||[]).filter(d=>d.category===typescript.DiagnosticCategory.Error);
  assert.equal(errors.length,0,'API syntax must be valid TypeScript');
  const exports={};
  const stubbedRequire=path=>{
    if(path==='../../../chatgpt-auth')return {getChatGPTUser:async()=>authenticated?{userId:'real-principal'}:null};
    if(path==='../../../project-registry')return {projectRepositories:[{id:'application-management',repository:REPO}]};
    if(path==='../../../blueprint-compass-core.mjs')return core;
    throw new Error(`Unexpected import ${path}`);
  };
  vm.runInNewContext(transpiled.outputText,{exports,require:stubbedRequire,fetch:fetchStub,Request,Response,URL,AbortSignal,Date,Error,console},{filename:'blueprint-compass-route.cjs'});
  return {GET:exports.GET,requests};
}

test('API denies unauthenticated access without calling GitHub',async()=>{
  const {GET,requests}=prepare({authenticated:false});
  const response=await GET(new Request('https://app.test/api/tools/blueprint-compass?id=application-management'));
  assert.equal(response.status,401);assert.equal(requests.length,0);
});
test('API denies an unknown project before calling GitHub',async()=>{
  const {GET,requests}=prepare();
  const response=await GET(new Request('https://app.test/api/tools/blueprint-compass?id=unknown'));
  assert.equal(response.status,400);assert.equal(requests.length,0);
});
test('API binds PR head separately, filters other-repo rows and remains advisory-only',async()=>{
  const {GET,requests}=prepare();
  const response=await GET(new Request('https://app.test/api/tools/blueprint-compass?id=application-management'));
  assert.equal(response.status,200);
  const json=await response.json();
  assert.equal(json.head,SHAMAIN);assert.equal(json.pullRequests[0].headSha,SHAPR);
  assert.deepEqual(json.issues.map(x=>x.number),[8]);
  assert.equal(json.verdict.qaPassed,false);assert.equal(json.canonicalGateVerified,false);
  assert.equal(json.humanReviewVerified,false);
  assert.equal(json.evidenceClass,'UNSIGNED_GITHUB_METADATA_ONLY');
  assert.equal(requests.length,4);
  assert.ok(requests.every(x=>x.method==='GET'&&!x.hasAuthorization));
  assert.ok(requests.every(x=>x.redirect==='manual'),'workerd supports manual redirects; redirected repository evidence must be rejected');
});
test('upstream GitHub auth/rate failure produces 502 UNVERIFIED without approval',async()=>{
  const {GET}=prepare({upstream:'forbidden'});
  const response=await GET(new Request('https://app.test/api/tools/blueprint-compass?id=application-management'));
  assert.equal(response.status,502);const data=await response.json();
  assert.equal(data.status,'UNVERIFIED');assert.equal(data.verdict.qaPassed,false);assert.equal(data.verdict.productionAuthorized,false);
});

test('repository redirects or mismatched metadata cannot establish selected-project evidence',async()=>{
  const {GET,requests}=prepare({overrides:{metadata:{full_name:'BlueDragon33/BOIECH_AI',default_branch:'main'}}});
  const response=await GET(new Request('https://app.test/api/tools/blueprint-compass?id=application-management'));
  assert.equal(response.status,502);
  assert.equal((await response.json()).verdict.status,'UNVERIFIED');
  assert.ok(!requests.some(request=>request.url.includes('/commits/')));
});
test('malformed listings and invalid commit SHA fail closed instead of showing an empty successful sample',async()=>{
  for (const overrides of [{pulls:{}},{issues:null},{commit:{sha:'main'}}]) {
    const {GET}=prepare({overrides});
    const response=await GET(new Request('https://app.test/api/tools/blueprint-compass?id=application-management'));
    assert.equal(response.status,502);
    const data=await response.json();
    assert.equal(data.status,'UNVERIFIED');
    assert.equal(data.verdict.qaPassed,false);
  }
});

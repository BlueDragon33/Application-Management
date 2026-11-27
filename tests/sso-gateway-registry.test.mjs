import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { webcrypto } from "node:crypto";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const src = readFileSync(new URL("../worker/sso-gateway.ts",import.meta.url),"utf8");
const js = transpileModule(src,{compilerOptions:{module:ModuleKind.ESNext,target:ScriptTarget.ES2022}}).outputText;
const {authorizeManagedSso,exchangeManagedSso}=await import(
  "data:text/javascript;base64,"+Buffer.from(js).toString("base64")
);
const issuer="https://application-management.boiech-ai.workers.dev";
const callback="https://software-blueprint-hub-git-main-dinhnam3391-4708.vercel.app/api/sso/callback";
const verifier="p".repeat(43),state="s".repeat(40);
const b64 = (b) => Buffer.from(b).toString("base64url");
const challenge=async(v)=>b64(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)));
function setup() {
 const clients=new Map([["software-blueprint-hub",{
    client_id:"software-blueprint-hub",redirect_uri:callback,
    required_role:"owner",status:"enabled"
 }]]);
 const accounts=new Map([["owner@example.com",{role:"owner",status:"active"}]]);
 const codes=new Map();
 const DB={prepare(sql){return{bind(...args){return{
    async run(){
      if(!sql.includes("INSERT INTO managed_browser_sso_codes"))throw Error("unexpected insert");
      codes.set(args[0],{client_id:args[1],redirect_uri:args[2],challenge:args[3],email:args[4],expires:args[5]});
      return{success:true};
    },
    async first(){
      if(sql.includes("FROM managed_browser_sso_clients"))return clients.get(args[0])??null;
      if(sql.includes("FROM control_accounts"))return accounts.get(args[0])??null;
      if(sql.includes("DELETE FROM managed_browser_sso_codes")){
        const rec=codes.get(args[0]);
        if(!rec||rec.client_id!==args[1]||rec.redirect_uri!==args[2]||
           rec.challenge!==args[3]||rec.expires<=args[4])return null;
        codes.delete(args[0]);return{actor_email:rec.email};
      }
      throw Error("Unexpected select: "+sql);
    }
 }}}}};
 const identity={email:"Owner@Example.com",authMethod:"google",mustChangePassword:true};
 function authorizeUrl(id="software-blueprint-hub",redirect=callback){
    const url=new URL("/__sso/v2/authorize",issuer);
    Object.entries({response_type:"code",client_id:id,redirect_uri:redirect,
      state,code_challenge_method:"S256"}).forEach(([k,v])=>url.searchParams.set(k,v));
    return url;
 }
 async function grant(url=authorizeUrl(),id=identity,now=10000){
    if(!url.searchParams.has("code_challenge"))url.searchParams.set("code_challenge",await challenge(verifier));
    return authorizeManagedSso(new Request(url),{DB},id,now);
 }
 async function redeem(code,v=verifier,now=10001,id="software-blueprint-hub",redirect=callback){
    return exchangeManagedSso(new Request(issuer+"/__sso/v2/token",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({client_id:id,redirect_uri:redirect,code,code_verifier:v})
    }),{DB},now);
 }
 return {DB,clients,accounts,codes,identity,authorizeUrl,grant,redeem};
}
test("registered client receives a one-time audience-bound PKCE grant",async()=>{
 const f=setup();const r=await f.grant();
 assert.equal(r.status,303);const callbackUrl=new URL(r.headers.get("location"));
 assert.equal(callbackUrl.origin,new URL(callback).origin);
 assert.equal(callbackUrl.searchParams.get("state"),state);
 assert.equal(r.headers.get("cache-control"),"no-store, private");
 const code=callbackUrl.searchParams.get("code");
 assert.equal(typeof code,"string");
 const result=await f.redeem(code);assert.equal(result.status,200);
 const identity=await result.json();
 assert.deepEqual({issuer:identity.issuer,audience:identity.audience,subject:identity.subject,
   authMethod:identity.authMethod,emailVerified:identity.emailVerified,appManageRole:identity.appManageRole},{
   issuer,audience:"software-blueprint-hub",subject:"owner@example.com",
   authMethod:"google",emailVerified:true,appManageRole:"owner"
 });
 assert.equal((await f.redeem(code)).status,401,"replayed grant rejected");
});
test("D1 registration prevents arbitrary redirect, disabled clients and unregistered apps",async()=>{
 const f=setup();
 assert.equal((await f.grant(f.authorizeUrl("evil-app"))).status,403);
 assert.equal((await f.grant(f.authorizeUrl("software-blueprint-hub","https://evil.example/callback"))).status,403);
 f.clients.get("software-blueprint-hub").status="disabled";
 assert.equal((await f.grant()).status,403);
 f.clients.get("software-blueprint-hub").status="enabled";
 f.clients.get("software-blueprint-hub").redirect_uri="https://evil.example/*";
 assert.equal((await f.grant()).status,403);
 assert.equal(f.codes.size,0);
});
test("Google owner gate is checked both at grant issuance and token redemption",async()=>{
 const f=setup();
 assert.equal((await f.grant(f.authorizeUrl(),{...f.identity,authMethod:"password"})).status,303);
 assert.equal(f.codes.size,0,"password may not issue SSO even if account owner");
 f.accounts.get("owner@example.com").role="reviewer";
 assert.equal((await f.grant()).status,403);
 f.accounts.get("owner@example.com").role="owner";
 const granted=await f.grant();
 const code=new URL(granted.headers.get("location")).searchParams.get("code");
 f.accounts.get("owner@example.com").status="blocked";
 assert.equal((await f.redeem(code)).status,403,"revoked owner cannot redeem");
});
test("wrong verifier, wrong audience and expiry all fail closed without consuming a valid grant",async()=>{
 const f=setup();const r=await f.grant();
 const code=new URL(r.headers.get("location")).searchParams.get("code");
 assert.equal((await f.redeem(code,"x".repeat(43))).status,401);
 assert.equal((await f.redeem(code,verifier,10001,"other-app")).status,401);
 assert.equal((await f.redeem(code,verifier,10001,"software-blueprint-hub","https://other.example/callback")).status,401);
 assert.equal((await f.redeem(code,verifier,10061)).status,401);
});
test("registered schema is absent or invalid and never silently falls back to a wildcard client",async()=>{
 const f=setup();
 f.clients.get("software-blueprint-hub").required_role="viewer";
 assert.equal((await f.grant()).status,403);
 assert.equal(f.codes.size,0);
});

test("registered SSO callback can move off Vercel without redirect fallback or replay",async()=>{
 const f=setup();
 const newCallback="https://blueprint.example.test/api/sso/callback";
 const original=await f.grant();
 assert.equal(original.status,303);
 const previousCode=new URL(original.headers.get("location")).searchParams.get("code");
 const client=f.clients.get("software-blueprint-hub");

 // This simulates a future owner-authorized D1 registration update, NOT a
 // deployed provider cutover, DNS change or production migration.
 client.redirect_uri=newCallback;
 assert.equal((await f.grant(f.authorizeUrl("software-blueprint-hub",callback))).status,403,
   "old callback cannot silently remain an alias");
 assert.equal((await f.redeem(previousCode,verifier,10001,"software-blueprint-hub",callback)).status,401,
   "a pre-cutover code cannot be exchanged against the old callback");
 assert.equal((await f.redeem(previousCode,verifier,10001,"software-blueprint-hub",newCallback)).status,401,
   "a pre-cutover code cannot be rebound to the new callback");

 const granted=await f.grant(f.authorizeUrl("software-blueprint-hub",newCallback));
 assert.equal(granted.status,303);
 const redirected=new URL(granted.headers.get("location"));
 assert.equal(redirected.origin,"https://blueprint.example.test");
 assert.equal(redirected.pathname,"/api/sso/callback");
 assert.equal(redirected.searchParams.get("state"),state);
 const code=redirected.searchParams.get("code");
 assert.equal((await f.redeem(code,verifier,10001,"software-blueprint-hub",callback)).status,401);
 assert.equal((await f.redeem(code,verifier,10001,"software-blueprint-hub",newCallback)).status,200);
 assert.equal((await f.redeem(code,verifier,10001,"software-blueprint-hub",newCallback)).status,401,
   "the replacement endpoint never permits grant replay");

 // Registration is data-driven, but it must still require an exact HTTPS URL.
 client.redirect_uri="http://localhost:3000/api/sso/callback";
 assert.equal((await f.grant(f.authorizeUrl("software-blueprint-hub",client.redirect_uri))).status,403);
 client.redirect_uri="https://blueprint.example.test/*";
 assert.equal((await f.grant(f.authorizeUrl("software-blueprint-hub",client.redirect_uri))).status,403);
});

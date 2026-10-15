import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { test } from "node:test";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const source = readFileSync(new URL("../worker/blueprint-sso.ts", import.meta.url), "utf8");
const javascript = transpileModule(source, {
  compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 }
}).outputText;
const { authorizeBlueprintSso, exchangeBlueprintSso } = await import(
  "data:text/javascript;base64," + Buffer.from(javascript).toString("base64")
);
const HUB_CALLBACK = "https://software-blueprint-hub-git-main-dinhnam3391-4708.vercel.app/api/sso/callback";
const b64 = (bytes) => Buffer.from(bytes).toString("base64url");
const challengeFor = async (verifier) => b64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
const verifier = "q".repeat(43);
const state = "s".repeat(40);
function fixture() {
  const codes = new Map();
  const accounts = new Map([["owner@example.com", { role:"owner",status:"active" }]]);
  const DB = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              if (!sql.includes("INSERT INTO hub_sso_authorization_codes")) throw Error("unexpected D1 run");
              codes.set(args[0], { client:args[1], redirect:args[2], challenge:args[3], email:args[4], exp:args[5] });
              return { success:true };
            },
            async first() {
              if (sql.includes("DELETE FROM hub_sso_authorization_codes")) {
                const row = codes.get(args[0]);
                if (!row || row.client !== args[1] || row.redirect !== args[2] ||
                    row.challenge !== args[3] || row.exp <= args[4]) return null;
                codes.delete(args[0]);
                return { actor_email:row.email };
              }
              if (sql.includes("SELECT role,status") || sql.includes("SELECT status"))
                return accounts.get(args[0]) ?? null;
              throw Error("unexpected D1 select");
            }
          };
        }
      };
    }
  };
  const identity = {
    email:"owner@example.com", displayName:"Owner", mustChangePassword:false,
    sessionHash:"verified-session", authMethod:"google",stepUpAt:null
  };
  const url = new URL("https://application-management.boiech-ai.workers.dev/__sso/authorize");
  url.searchParams.set("response_type","code");
  url.searchParams.set("client_id","software-blueprint-hub");
  url.searchParams.set("redirect_uri",HUB_CALLBACK);
  url.searchParams.set("code_challenge_method","S256");
  url.searchParams.set("state",state);
  return { DB, codes, accounts, identity, url };
}
test("auth code is issued to exact registered callback and can be redeemed once by PKCE", async () => {
  const f=fixture();
  f.url.searchParams.set("code_challenge",await challengeFor(verifier));
  const issued=await authorizeBlueprintSso(new Request(f.url),f,f.identity,10000);
  assert.equal(issued.status,303);
  const destination=new URL(issued.headers.get("location"));
  assert.equal(destination.origin,new URL(HUB_CALLBACK).origin);
  assert.equal(destination.searchParams.get("state"),state);
  assert.equal(issued.headers.get("referrer-policy"),"no-referrer");
  const code=destination.searchParams.get("code");
  const redeem=() => exchangeBlueprintSso(new Request("https://application-management.boiech-ai.workers.dev/__sso/token",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({code,code_verifier:verifier,client_id:"software-blueprint-hub",redirect_uri:HUB_CALLBACK})
  }),f,10001);
  const result=await redeem();
  assert.equal(result.status,200);
  const json=await result.json();
  assert.deepEqual({email:json.email,issuer:json.issuer,audience:json.audience},{
    email:"owner@example.com",issuer:"https://application-management.boiech-ai.workers.dev",audience:"software-blueprint-hub"
  });
  assert.equal(json.authMethod,"google");
  assert.equal(json.emailVerified,true);
  assert.equal(json.appManageRole,"owner");
  assert.equal((await redeem()).status,401,"code replay must be blocked in durable D1");
});
test("wrong verifier, malformed callback, wrong client or missing session privileges fail closed",async()=>{
 const f=fixture();f.url.searchParams.set("code_challenge",await challengeFor(verifier));
 const incomplete = await authorizeBlueprintSso(new Request(f.url), f,
   {...f.identity, mustChangePassword:true, authMethod:"password"}, 10000);
 assert.equal(incomplete.status,303,"browser must be guided to account setup");
 assert.equal(incomplete.headers.get("location"),
   "https://application-management.boiech-ai.workers.dev/__account?sso=google");
 assert.equal(incomplete.headers.get("cache-control"),"no-store, private");
 assert.equal(f.codes.size,0,"no SSO grant issued to an incomplete account");
 const wrongMethod = await authorizeBlueprintSso(new Request(f.url,{method:"POST"}),
   f,f.identity,10000);
 assert.equal(wrongMethod.status,405);
 assert.equal(f.codes.size,0);
 const wrong=new URL(f.url);wrong.searchParams.set("redirect_uri","https://evil.example/callback");
 assert.equal((await authorizeBlueprintSso(new Request(wrong),f,f.identity,10000)).status,400);
 f.accounts.set("owner@example.com",{role:"owner",status:"suspended"});
 assert.equal((await authorizeBlueprintSso(new Request(f.url),f,f.identity,10000)).status,403);
 f.accounts.set("owner@example.com",{role:"owner",status:"active"});
 const issue=await authorizeBlueprintSso(new Request(f.url),f,f.identity,10000);
 const code=new URL(issue.headers.get("location")).searchParams.get("code");
 const payload={code,code_verifier:"x".repeat(43),client_id:"software-blueprint-hub",redirect_uri:HUB_CALLBACK};
 const call=(body,now)=>exchangeBlueprintSso(new Request("https://application-management.boiech-ai.workers.dev/__sso/token",{
   method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)
 }),f,now);
 assert.equal((await call(payload,10001)).status,401);
 assert.equal((await call({...payload,code_verifier:verifier,redirect_uri:"https://wrong.example"},10001)).status,400);
 assert.equal((await call({...payload,code_verifier:verifier},10001)).status,200);
 assert.equal((await call({...payload,code_verifier:verifier},10002)).status,401);
});
test("verified Google sign-in works with optional recovery-password reset still pending", async () => {
 const f=fixture();
 f.url.searchParams.set("code_challenge",await challengeFor(verifier));
 const issued=await authorizeBlueprintSso(new Request(f.url), f,
  {...f.identity, mustChangePassword:true, authMethod:"google"}, 10000);
 assert.equal(issued.status,303);
 assert.equal(new URL(issued.headers.get("location")).origin,new URL(HUB_CALLBACK).origin);
 assert.equal(f.codes.size,1,"real PKCE grant issued from verified Google session");
 // Password-bootstrap sessions must NOT be exchanged for Hub authority.
 const recovery=await authorizeBlueprintSso(new Request(f.url), f,
  {...f.identity, mustChangePassword:true, authMethod:"password"}, 10000);
 assert.equal(recovery.status,303);
 assert.equal(new URL(recovery.headers.get("location")).pathname,"/__account");
 assert.equal(f.codes.size,1,"recovery-password login did not issue any new grant");
});

test("a password session can never mint cross-provider auto-link identity, even after password rotation",async()=>{
 const f=fixture(); f.url.searchParams.set("code_challenge",await challengeFor(verifier));
 const grant=await authorizeBlueprintSso(new Request(f.url),f,
  {...f.identity,mustChangePassword:false,authMethod:"password"},10000);
 assert.equal(grant.status,303);
 assert.equal(new URL(grant.headers.get("location")).pathname,"/__account");
 assert.equal(f.codes.size,0);
});
test("privileged Blueprint single tap rejects an App-Manage reviewer and role downgrade on redemption",async()=>{
 const f=fixture();f.url.searchParams.set("code_challenge",await challengeFor(verifier));
 f.accounts.set("owner@example.com",{role:"viewer",status:"active"});
 assert.equal((await authorizeBlueprintSso(new Request(f.url),f,f.identity,10000)).status,403);
 f.accounts.set("owner@example.com",{role:"owner",status:"active"});
 const issue=await authorizeBlueprintSso(new Request(f.url),f,f.identity,10000);
 const code=new URL(issue.headers.get("location")).searchParams.get("code");
 f.accounts.set("owner@example.com",{role:"reviewer",status:"active"});
 const response=await exchangeBlueprintSso(new Request("https://application-management.boiech-ai.workers.dev/__sso/token",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({code,code_verifier:verifier,client_id:"software-blueprint-hub",redirect_uri:HUB_CALLBACK})
 }),f,10001);
 assert.equal(response.status,403,"downgraded owner must not redeem privileged grant");
});
test("expired codes cannot be exchanged and role revocation is rechecked",async()=>{
 const f=fixture();f.url.searchParams.set("code_challenge",await challengeFor(verifier));
 const req=()=>authorizeBlueprintSso(new Request(f.url),f,f.identity,10000);
 const issue=await req();const code=new URL(issue.headers.get("location")).searchParams.get("code");
 const body=(code)=>({code,code_verifier:verifier,client_id:"software-blueprint-hub",redirect_uri:HUB_CALLBACK});
 const token=(code,now)=>exchangeBlueprintSso(new Request("https://application-management.boiech-ai.workers.dev/__sso/token",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body(code))
 }),f,now);
 assert.equal((await token(code,10061)).status,401);
 const next=await req();const fresh=new URL(next.headers.get("location")).searchParams.get("code");
 f.accounts.set("owner@example.com",{role:"owner",status:"blocked"});
 assert.equal((await token(fresh,10002)).status,403);
});

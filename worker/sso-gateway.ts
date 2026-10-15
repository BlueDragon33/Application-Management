/** Registered, app-scoped browser SSO gateway.
 * This is independent of the original Blueprint /__sso/* pilot routes.
 * No browser sends privileged roles; the issuing server checks the real
 * App-Manage Google session and registered D1 client on every grant.
 */
import type { ProductionIdentity } from "./production-auth";

interface Env { readonly DB: D1Database }
interface RegisteredClient {
  readonly client_id: string;
  readonly redirect_uri: string;
  readonly required_role: "owner";
  readonly status: "enabled" | "disabled";
}
const ttlSeconds = 60;
const encode = (a: Uint8Array) => btoa(String.fromCharCode(...a))
  .replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
const hex = (a: Uint8Array) => Array.from(a).map(n => n.toString(16).padStart(2,"0")).join("");
const digest = async (v: string) => new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)));
const json = (body: Record<string,unknown>,status=200) => Response.json(body,{
 status,headers:{"cache-control":"no-store, private","referrer-policy":"no-referrer",
 "x-content-type-options":"nosniff","content-security-policy":"default-src 'none'"}
});
const clientPattern = /^[a-z0-9][a-z0-9-]{2,63}$/;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const verifierPattern = /^[A-Za-z0-9_-]{43,128}$/;
const statePattern = /^[A-Za-z0-9_-]{32,100}$/;
function validCallback(url: string): boolean {
  try {
    const value = new URL(url);
    return value.protocol === "https:" && value.hostname.includes(".") &&
      !value.username && !value.password && !value.search && !value.hash &&
      value.pathname !== "/" && !value.pathname.includes("*") &&
      value.href === url && !url.includes("\\");
  } catch { return false; }
}
async function registered(db: D1Database, clientId: string): Promise<RegisteredClient | null> {
  const record = await db.prepare(
    "SELECT client_id,redirect_uri,required_role,status FROM managed_browser_sso_clients WHERE client_id=?1 LIMIT 1"
  ).bind(clientId).first<RegisteredClient>();
  return record && record.status === "enabled" &&
    record.required_role === "owner" && validCallback(record.redirect_uri) ? record : null;
}
async function ownerAccount(db: D1Database,email: string): Promise<boolean> {
  const account = await db.prepare("SELECT role,status FROM control_accounts WHERE email=?1 LIMIT 1")
    .bind(email).first<{ role: string; status: string }>();
  return account?.role === "owner" && account.status === "active";
}
export async function authorizeManagedSso(
  request: Request, env: Env, identity: ProductionIdentity,
  now=Math.floor(Date.now()/1000)
): Promise<Response> {
  if(request.method !== "GET") return json({error:"method_not_allowed"},405);
  if(identity.authMethod !== "google") {
    return new Response(null,{status:303,headers:{
      location:new URL("/__account?sso=google",request.url).href,
      "cache-control":"no-store, private","referrer-policy":"no-referrer"
    }});
  }
  const url=new URL(request.url),clientId=url.searchParams.get("client_id")??"";
  const redirectUri=url.searchParams.get("redirect_uri")??"";
  const state=url.searchParams.get("state")??"";
  const challenge=url.searchParams.get("code_challenge")??"";
  if(!clientPattern.test(clientId)||!statePattern.test(state)||
    !tokenPattern.test(challenge)||
    url.searchParams.get("response_type")!=="code"||
    url.searchParams.get("code_challenge_method")!=="S256")
    return json({error:"invalid_request"},400);
  const client=await registered(env.DB,clientId);
  if(!client||redirectUri!==client.redirect_uri) return json({error:"unregistered_sso_client"},403);
  const email=identity.email.trim().toLowerCase();
  if(!email||!await ownerAccount(env.DB,email)) return json({error:"access_denied"},403);
  const code=encode(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare(
    "INSERT INTO managed_browser_sso_codes (code_hash,client_id,redirect_uri,code_challenge,actor_email,expires_at,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)"
  ).bind(hex(await digest(code)),clientId,redirectUri,challenge,email,now+ttlSeconds,now).run();
  const next=new URL(client.redirect_uri);
  next.searchParams.set("code",code);
  next.searchParams.set("state",state);
  return new Response(null,{status:303,headers:{
    location:next.href,"cache-control":"no-store, private","referrer-policy":"no-referrer",
    "x-content-type-options":"nosniff","content-security-policy":"default-src 'none'"
  }});
}
export async function exchangeManagedSso(
  request: Request,env: Env,now=Math.floor(Date.now()/1000)
): Promise<Response> {
  if(request.method!=="POST") return json({error:"method_not_allowed"},405);
  if((Number(request.headers.get("content-length"))||0)>4096) return json({error:"too_large"},413);
  const raw=await request.text().catch(()=>null);
  if(!raw||raw.length>4096) return json({error:"invalid_request"},400);
  let body:unknown; try{body=JSON.parse(raw)}catch{return json({error:"invalid_request"},400)}
  if(!body||typeof body!=="object"||Array.isArray(body)) return json({error:"invalid_request"},400);
  const {client_id,redirect_uri,code,code_verifier}=body as Record<string,unknown>;
  if(typeof client_id!=="string"||!clientPattern.test(client_id)||
    typeof redirect_uri!=="string"||typeof code!=="string"||!tokenPattern.test(code)||
    typeof code_verifier!=="string"||!verifierPattern.test(code_verifier)) return json({error:"invalid_grant"},400);
  const client=await registered(env.DB,client_id);
  if(!client||redirect_uri!==client.redirect_uri) return json({error:"invalid_grant"},401);
  const record=await env.DB.prepare(
    "DELETE FROM managed_browser_sso_codes WHERE code_hash=?1 AND client_id=?2 AND redirect_uri=?3 AND code_challenge=?4 AND expires_at>?5 RETURNING actor_email"
  ).bind(hex(await digest(code)),client_id,redirect_uri,encode(await digest(code_verifier)),now)
    .first<{actor_email:string}>();
  if(!record) return json({error:"invalid_grant"},401);
  if(!await ownerAccount(env.DB,record.actor_email)) return json({error:"account_revoked"},403);
  return json({
    issuer:new URL(request.url).origin,audience:client.client_id,
    subject:record.actor_email,email:record.actor_email,
    authMethod:"google",emailVerified:true,appManageRole:"owner",expiresAt:now+ttlSeconds
  });
}

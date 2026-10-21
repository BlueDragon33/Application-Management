// Blueprint OS 1.3.0 P0: App-Manager owning D1 catalog, NOT an in-memory catalog.
// App-Manager's actual upsert/list/decrypt functions -> isolated Wrangler LOCAL D1.
// The SQL bridge runs each prepared statement through a new Wrangler CLI process;
// this is a real D1 local SQLite backend, NOT a native D1 binding/Next.js route.
// An independent QA-only HTTP GET and a restarted Node source verify persistence.
// No user D1, no shared .wrangler/state, no network worker, no production auth/UI.
// Previously PASS 4/4 fixture and PriceReport Worker+D1 pilots are NOT rerun.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createHash,randomBytes,randomUUID,webcrypto} from "node:crypto";
import {once} from "node:events";
import {existsSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from "node:fs";
import {createServer} from "node:http";
import {tmpdir} from "node:os";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {stripTypeScriptTypes} from "node:module";

const APP=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const DEPS=resolve(process.env.APP_MANAGER_D1_QA_DEPS_ROOT||"");
const APP_EXPECTED_HEAD=process.env.APP_MANAGER_D1_QA_EXPECTED_HEAD||"";
const BASELINE_BLOB="342f744ae90ec37e379dce9f6b647e454a3ceccd";
const MIGRATION_BLOB="d66ccf0399223dde36b8cbcdc8d1c7750f8d15a3";
const WRANGLER=join(DEPS,"node_modules","wrangler","bin","wrangler.js");
const APP_ID="price-report-p0-local-catalog";
const allowEnv={...process.env,CI:"1",WRANGLER_SEND_METRICS:"false",
  GIT_TERMINAL_PROMPT:"0",npm_config_update_notifier:"false"};
for(const key of ["CLOUDFLARE_API_KEY","CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID","CF_API_TOKEN","WRANGLER_API_TOKEN"])delete allowEnv[key];

function command(file,args,options={}){
  const r=spawnSync(file,args,{windowsHide:true,encoding:"utf8",
    timeout:90000,maxBuffer:4*1024*1024,env:allowEnv,...options});
  if(r.error||r.status!==0)throw Error("BLOCKED_COMMAND_"+String(args[0])+": "+
    String(r.error?.message||r.stderr||r.stdout||r.status).slice(-600));
  return r.stdout.trim();
}
function git(args){return command("git",["-C",APP,...args]);}
function preflight(){
  assert.match(APP_EXPECTED_HEAD,/^[a-f0-9]{40}$/,"BLOCKED_EXACT_QA_HEAD_REQUIRED");
  assert.equal(git(["rev-parse","HEAD"]),APP_EXPECTED_HEAD,"BLOCKED_APP_SHA_DRIFT");
  assert.equal(git(["status","--porcelain","--untracked-files=no"]),"","BLOCKED_DIRTY_APP_CHECKOUT");
  assert.equal(git(["rev-parse","HEAD:app/open-contract.server.ts"]),BASELINE_BLOB,
    "BLOCKED_UNVERIFIED_APP_MANAGER_SOURCE");
  assert.equal(git(["rev-parse","HEAD:drizzle/0005_managed_app_catalog.sql"]),MIGRATION_BLOB,
    "BLOCKED_UNVERIFIED_MANAGED_CATALOG_MIGRATION");
  assert.ok(process.env.APP_MANAGER_D1_QA_DEPS_ROOT,"BLOCKED_EXPLICIT_VERIFIED_DEPS_REQUIRED");
  assert.ok(existsSync(WRANGLER),"BLOCKED_VERIFIED_WRANGLER_BINARY_MISSING");
  assert.equal(JSON.parse(readFileSync(join(DEPS,"node_modules","wrangler","package.json"),"utf8")).version,
    "4.151.1","BLOCKED_LOCKED_WRANGLER_VERSION");
}
function quote(value){
  if(value===null)return "NULL";
  if(typeof value==="string")return "'"+value.replaceAll("'","''")+"'";
  if(typeof value==="number"&&Number.isFinite(value))return String(value);
  if(typeof value==="boolean")return value?"1":"0";
  throw Error("BLOCKED_UNSUPPORTED_D1_BIND_TYPE");
}
function bindSQL(sql,args){
  assert.match(sql,/^\s*(?:SELECT|INSERT|DELETE)\b/i,"BLOCKED_UNEXPECTED_SQL_VERB");
  assert.match(sql,/\bmanaged_app_catalog\b/i,"BLOCKED_NON_CATALOG_SQL");
  assert.doesNotMatch(sql,/;\s*\S/,"BLOCKED_MULTIPLE_SQL_STATEMENTS");
  let next=0;
  const used=new Set();
  const full=sql.replace(/\?(\d+)?/g,(_,n)=>{
    const idx=n?Number(n)-1:next++;
    assert.ok(idx>=0&&idx<args.length,"BLOCKED_BIND_INDEX");
    used.add(idx);
    return quote(args[idx]);
  });
  assert.equal(used.size,args.length,"BLOCKED_UNUSED_D1_BIND_ARGUMENT");
  return full;
}
function parseJson(output){
  const offset=output.indexOf("[");
  assert.ok(offset>=0,"BLOCKED_WRANGLER_JSON_MISSING");
  const data=JSON.parse(output.slice(offset));
  assert.ok(Array.isArray(data),"BLOCKED_WRANGLER_INVALID_JSON");
  for(const item of data)assert.notEqual(item.success,false,"BLOCKED_WRANGLER_D1_EXECUTION_FAILURE");
  return data;
}
function cliContext(config,store,name,temp){
  let seq=0;
  const query=(sql)=>{
    // SQL containing encrypted credential material goes into a private file,
    // never into process argv. All files stay inside the fresh QA temp root.
    const file=join(temp,"query-"+process.pid+"-"+(++seq)+".sql");
    writeFileSync(file,sql+";\n",{flag:"wx",mode:0o600});
    let out;
    try{
      out=command(process.execPath,[WRANGLER,"d1","execute",name,"--local",
        "--config",config,"--persist-to",store,"--file",file,"--json"],{cwd:APP});
    }finally{
      try{rmSync(file,{force:true})}
      catch(e){throw Error("BLOCKED_QA_TRANSIENT_SQL_FILE_RETAINED: "+file)}
    }
    return parseJson(out);
  };
  return {query,
    prepare(sql){
      const make=(args)=>({
        first:async()=>query(bindSQL(sql,args)).flatMap(x=>x.results||[])[0]??null,
        all:async()=>({results:query(bindSQL(sql,args)).flatMap(x=>x.results||[])}),
        run:async()=>{
          const records=query(bindSQL(sql,args));
          return {success:records.every(x=>x.success!==false),
            meta:{changes:records.reduce((n,x)=>n+Number(x.meta?.changes||0),0)}};
        },
      });
      return {...make([]),bind:(...args)=>make(args)};
    },
  };
}
function appSource(d1,variables){
  const source=readFileSync(join(APP,"app","open-contract.server.ts"),"utf8");
  const compiled=stripTypeScriptTypes(source).replace(/^import .*;$/gm,"").replace(/^export /gm,"");
  const factory=new Function("getControlDatabase","contractCategoryProfiles",
    "dynamicApplicationConfig","fetch","crypto","process",compiled+
    "\nreturn {upsertManagedCatalog,listManagedCatalog,decryptCredential,managedCredentialEncryptionReady};");
  return factory(async()=>d1,{"Báo cáo":{}},x=>({...x}),fetch,webcrypto,
    {env:{...process.env,...variables}});
}
function publicView(row){
  return {id:row.id,name:row.name,category:row.category,origin:row.origin,
    contractPath:row.contract_path,credentialConfigured:
      Boolean(row.credential_ciphertext&&row.credential_iv),
    enabled:row.enabled===1,createdBy:row.created_by};
}
function digest(row){
  return createHash("sha256").update(row.credential_ciphertext+"."+row.credential_iv).digest("hex");
}
async function restartedReader(){
  preflight();
  let input="";
  for await(const chunk of process.stdin)input+=chunk.toString();
  const info=JSON.parse(input);
  // The AES key and fixture token arrive through the child stdin pipe,
  // not process arguments, environment variables or QA config files.
  const d1=cliContext(info.config,info.store,info.db,info.temp);
  const module=appSource(d1,{
    LOCAL_DEV_AUTH:"1",CONTROL_PLANE_NETWORK_MODE:"local",
    MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY:info.masterKey});
  const rows=await module.listManagedCatalog();
  const row=rows.find(x=>x.id===APP_ID);
  assert.ok(row,"BLOCKED_RESTARTED_D1_ROW_MISSING");
  assert.equal(row.name,info.finalName,"BLOCKED_RESTARTED_D1_NAME_NOT_PERSISTED");
  assert.equal(row.contract_path,"/api/control/status","BLOCKED_RESTARTED_CONTRACT_PATH");
  assert.equal(digest(row),info.credentialHash,"BLOCKED_RESTARTED_AES_CIPHERTEXT_DRIFT");
  assert.equal(await module.decryptCredential(row),info.secret,
    "BLOCKED_RESTARTED_AES_DECRYPT_FAILED");
  console.log(JSON.stringify({checkpoint:"APP_MANAGER_CATALOG_RESTART_READBACK_PASS",
    appManagerSha:APP_EXPECTED_HEAD,realD1Local:true,
    restartedNode:true,encryptedCredentialVerified:true,
    realAppManagerGetRoute:false,productionTouched:false}));
}
async function run(){
  preflight();
  const temp=mkdtempSync(join(tmpdir(),"app-manager-owning-d1-p0-"));
  const store=join(temp,"sqlite"),config=join(temp,"qa-wrangler.jsonc");
  const db="app-manager-p0-"+randomBytes(6).toString("hex");
  const dbId=randomUUID();
  writeFileSync(config,JSON.stringify({
    name:db,d1_databases:[{binding:"DB",database_name:db,database_id:dbId}],
    compatibility_date:"2026-08-26",compatibility_flags:["nodejs_compat"],
  },null,2),{flag:"wx",mode:0o600});
  const d1=cliContext(config,store,db,temp);
  let server=null,pass=false;
  try{
    // The original source migration is applied to a fresh, isolated local D1;
    // it never targets the user's configured learning-management-db.
    const migration=readFileSync(join(APP,"drizzle","0005_managed_app_catalog.sql"),"utf8");
    d1.query(migration.replace(/--> statement-breakpoint/g,""));
    const masterKey=randomBytes(32).toString("base64url");
    const secret=randomBytes(48).toString("base64url");
    const variables={LOCAL_DEV_AUTH:"1",CONTROL_PLANE_NETWORK_MODE:"local",
      MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY:masterKey};
    const source=appSource(d1,variables);
    const owner={role:"owner",email:"qa-owner@example.invalid"};
    const viewer={role:"viewer",email:"qa-viewer@example.invalid"};
    await assert.rejects(source.upsertManagedCatalog({id:APP_ID},viewer),/Chỉ Chủ hệ thống/);
    assert.equal(await source.managedCredentialEncryptionReady(),true);
    await source.upsertManagedCatalog({id:APP_ID,name:"PriceReport Catalog QA",
      shortName:"PriceReport QA",category:"Báo cáo",
      origin:"http://127.0.0.1:8787",contractPath:"/api/control/status",
      credential:secret},owner);
    const before=(await source.listManagedCatalog()).find(x=>x.id===APP_ID);
    assert.ok(before?.credential_ciphertext&&before?.credential_iv,"BLOCKED_AES_CREDENTIAL_NOT_WRITTEN");
    assert.ok(!JSON.stringify(before).includes(secret),"BLOCKED_CREDENTIAL_PLAINTEXT_IN_D1");
    assert.equal(await source.decryptCredential(before),secret,"BLOCKED_AES_DECRYPT_IN_WRITER");
    const ciphertextHash=digest(before);
    const changedName="PriceReport Catalog QA Reopen";
    await source.upsertManagedCatalog({id:APP_ID,name:changedName,
      shortName:"PriceReport QA",category:"Báo cáo",
      origin:"http://127.0.0.1:8787",contractPath:"/api/control/status",
      credential:""},owner);
    const after=(await source.listManagedCatalog()).find(x=>x.id===APP_ID);
    assert.equal(after.name,changedName,"BLOCKED_CATALOG_UPDATED_VALUE_NOT_READABLE");
    assert.equal(digest(after),ciphertextHash,"BLOCKED_BLANK_CREDENTIAL_OVERWROTE_EXISTING");
    // This is an independently queried QA HTTP GET, NOT the actual App-Manager API.
    const readToken=randomBytes(24).toString("base64url");
    server=createServer((req,res)=>{
      const finish=(code,body)=>{res.writeHead(code,{"content-type":"application/json",
        "cache-control":"no-store"});res.end(JSON.stringify(body))};
      if(req.method!=="GET"||new URL(req.url,"http://127.0.0.1").pathname!=="/qa/catalog")
        return finish(404,{ok:false});
      if(req.headers.authorization!=="Bearer "+readToken)return finish(403,{ok:false});
      try{
        const row=d1.query("SELECT id,name,category,origin,contract_path,enabled,created_by,credential_ciphertext,credential_iv FROM managed_app_catalog WHERE id='"+APP_ID+"'").flatMap(x=>x.results||[])[0];
        if(!row)return finish(404,{ok:false});
        return finish(200,{ok:true,catalog:publicView(row),encryptedCredentialHash:digest(row)});
      }catch(e){return finish(503,{ok:false,code:"QA_D1_READ_FAILED"})}
    });
    server.listen(0,"127.0.0.1");
    await once(server,"listening");
    const port=server.address().port;
    const response=await fetch("http://127.0.0.1:"+port+"/qa/catalog",{
      method:"GET",headers:{authorization:"Bearer "+readToken},redirect:"manual",
      signal:AbortSignal.timeout(15000)});
    assert.equal(response.status,200,"BLOCKED_INDEPENDENT_QA_HTTP_GET");
    const payload=await response.json();
    assert.equal(payload.catalog.name,changedName,"BLOCKED_INDEPENDENT_GET_STALE");
    assert.equal(payload.encryptedCredentialHash,ciphertextHash,"BLOCKED_INDEPENDENT_D1_AES_DRIFT");
    assert.equal(JSON.stringify(payload).includes(secret),false,"BLOCKED_HTTP_SECRET_EXPOSURE");
    await new Promise((ok,fail)=>server.close(e=>e?fail(e):ok()));
    server=null;
    const restarted=command(process.execPath,[fileURLToPath(import.meta.url),"--reopen"],{
      cwd:APP,input:JSON.stringify({temp,store,config,db,
        masterKey,secret,credentialHash:ciphertextHash,finalName:changedName}),
      timeout:140000});
    assert.match(restarted,/APP_MANAGER_CATALOG_RESTART_READBACK_PASS/,
      "BLOCKED_RESTARTED_NODE_READBACK");
    console.log(restarted);
    pass=true;
    console.log(JSON.stringify({result:"P0_APP_MANAGER_OWNING_LOCAL_D1_CATALOG_PASS",
      appManagerSha:APP_EXPECTED_HEAD,source:"APP_MANAGER_REAL",
      d1:"REAL_WRANGLER_LOCAL_DISPOSABLE",d1Binding:"WRANGLER_CLI_BRIDGE_NOT_NATIVE_WORKER",
      catalogInMemory:false,ownerOnly:true,aesGcm:true,
      credentialPreservedOnBlankUpdate:true,
      independentHttpGet:"QA_ONLY_NOT_PRODUCTION_ROUTE",
      reopenedNode:true,independentD1Cli:true,
      productionTouched:false,ci:"PENDING",globalD1:"10/10 BLOCKED",
      globalProcessQuiescence:"NOT_PROVEN"}));
  }finally{
    if(server){
      try{await new Promise(resolve=>server.close(()=>resolve()))}
      catch{process.exitCode=1;console.error("BLOCKED_QA_GET_SERVER_CLOSE")}
    }
    // Preserve disposable D1 as evidence. Never recursively delete or mutate
    // existing E:\BaumanWeb app D1/PriceReport pilot data.
    console.log("QA_APP_MANAGER_DISPOSABLE_D1_RETAINED: "+temp);
    if(!pass)process.exitCode=1;
  }
}
if(process.argv[2]==="--reopen")restartedReader().catch(e=>{
  console.error("P0_APP_CATALOG_REOPEN_NOT_PASSED:",e.message||String(e));process.exitCode=1;
});
else run().catch(e=>{
  console.error("P0_APP_CATALOG_D1_NOT_PASSED:",e.message||String(e));process.exitCode=1;
});

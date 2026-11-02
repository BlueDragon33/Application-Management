// Blueprint OS 1.3.0: inspect one already retained, disposable Windows MFA D1.
// Pure read-only diagnostic; never restarts Worker or reruns authenticated actions.
// Do not report successful forensics as native MFA E2E PASS.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {existsSync,lstatSync,readdirSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {dirname,join,relative,resolve,sep} from "node:path";
import {fileURLToPath} from "node:url";

const APP=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const EXPECTED=process.env.APP_MANAGER_MFA_FORENSIC_HEAD||"";
const ROOT=resolve(process.env.APP_MANAGER_MFA_NATIVE_RETAINED_ROOT||"");
function git(...args){
  return execFileSync("git",["-C",APP,...args],{
    encoding:"utf8",windowsHide:true,timeout:15000}).trim();
}
function preflight(){
  assert.equal(process.platform,"win32","BLOCKED_MFA_FORENSIC_WIN32_ONLY");
  assert.match(APP,/^[a-z]:\\BaumanWeb\\_qa\\AppManager-P0-native-/i,
    "BLOCKED_MFA_FORENSIC_NON_QA_SOURCE_ROOT");
  assert.match(EXPECTED,/^[a-f0-9]{40}$/,"BLOCKED_MFA_FORENSIC_PIN_REQUIRED");
  assert.equal(git("rev-parse","HEAD"),EXPECTED,"BLOCKED_MFA_FORENSIC_SHA_DRIFT");
  assert.equal(git("branch","--show-current"),"","BLOCKED_MFA_FORENSIC_NONDETACHED");
  assert.equal(git("status","--porcelain","--untracked-files=no"),"",
    "BLOCKED_MFA_FORENSIC_TRACKED_CHANGES");
  const rel=relative(join(APP,".wrangler"),ROOT);
  assert.ok(/^p0-mfa-native-qa-[a-f0-9]{16}$/i.test(rel)&&!rel.includes(sep),
    "BLOCKED_MFA_FORENSIC_NOT_ISOLATED_NAMESPACE");
  assert.ok(existsSync(ROOT)&&lstatSync(ROOT).isDirectory()&&
    !lstatSync(ROOT).isSymbolicLink(),
    "BLOCKED_MFA_FORENSIC_RETAINED_ROOT_MISSING");
}
function walk(p,depth=0){
  assert.ok(depth<=9,"BLOCKED_MFA_FORENSIC_DEPTH");
  if(!existsSync(p))return [];
  const entries=readdirSync(p,{withFileTypes:true});
  assert.ok(entries.length<=300,"BLOCKED_MFA_FORENSIC_WIDTH");
  const files=[];
  for(const entry of entries){
    assert.ok(!entry.isSymbolicLink(),"BLOCKED_MFA_FORENSIC_SYMLINK");
    const full=join(p,entry.name);
    if(entry.isDirectory())files.push(...walk(full,depth+1));
    else if(entry.isFile()&&/\.(sqlite|sqlite3|db)$/i.test(entry.name))
      files.push(full);
  }
  return files;
}
function inspect(){
  preflight();
  const state=join(ROOT,"persist");
  assert.ok(existsSync(state)&&lstatSync(state).isDirectory(),
    "BLOCKED_MFA_FORENSIC_NO_D1_STATE");
  const files=walk(state);
  assert.ok(files.length>0&&files.length<=80,"BLOCKED_MFA_FORENSIC_FILE_COUNT");
  const evidence=[],errors=[];
  for(const file of files){
    let db,stage="OPEN",error=null;
    try{
      db=new DatabaseSync(file,{readOnly:true});
      stage="SCHEMA";
      const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
        .map(r=>r.name);
      if(!tables.includes("control_mfa_factors"))continue;
      stage="MFA_FACTOR";
      const factors=db.prepare(
        "SELECT enabled, length(secret_ciphertext) AS cipher_bytes, length(secret_iv) AS iv_bytes FROM control_mfa_factors"
      ).all();
      stage="SESSIONS";
      const sessions=db.prepare(
        "SELECT auth_method,step_up_at,created_at,expires_at FROM control_sessions ORDER BY created_at"
      ).all();
      stage="OWNER";
      const accounts=db.prepare(
        "SELECT role,status,failed_attempts,locked_until FROM control_accounts"
      ).all();
      const now=Math.floor(Date.now()/1000);
      const record={
        file:relative(state,file),factorCount:factors.length,
        factors:factors.map(f=>({
          enabled:f.enabled===1,
          ciphertextPresent:Number(f.cipher_bytes)>0,
          ivPresent:Number(f.iv_bytes)>0
        })),
        accountCount:accounts.length,
        accounts:accounts.map(a=>({role:a.role,status:a.status,
          failedAttempts:Number(a.failed_attempts||0),
          loginLocked:a.locked_until!=null&&Number(a.locked_until)>now})),
        sessionCount:sessions.length,
        sessions:sessions.map(s=>({
          authMethod:s.auth_method,
          stepUpSet:s.step_up_at!=null,
          stepUpAgeSeconds:s.step_up_at==null?null:now-Number(s.step_up_at),
          sessionExpired:Number(s.expires_at)<=now
        }))
      };
      evidence.push(record);
      console.log("MFA_FORENSIC_NATIVE_D1: "+JSON.stringify(record));
    }catch(e){error=e}
    finally{
      try{db?.close()}catch(e){if(!error){error=e;stage="CLOSE"}}
    }
    if(error){
      const detail={file:relative(state,file),stage,
        code:String(error?.code||error?.name||"UNKNOWN").slice(0,100)};
      errors.push(detail);
      console.log("MFA_FORENSIC_READ_ERROR: "+JSON.stringify(detail));
    }
  }
  const summary={
    mode:"READ_ONLY_D1_FORENSIC_NOT_NATIVE_E2E",
    examinedFiles:files.length,canonicalD1Owners:evidence.length,
    readErrors:errors.length,
    secondSessionCreated:evidence.length===1?evidence[0].sessionCount>=2:null,
    secondSessionStepUpRecorded:evidence.length===1
      ?evidence[0].sessions.filter(s=>s.stepUpSet).length>=2:null,
    credentialValuesExposed:false,sqlWriteStatementsIssued:false,
    originalNativeE2E:"BLOCKED"
  };
  console.log("MFA_FORENSIC_SUMMARY: "+JSON.stringify(summary));
  assert.equal(errors.length,0,"BLOCKED_MFA_FORENSIC_SQLITE");
  assert.equal(evidence.length,1,"BLOCKED_MFA_FORENSIC_D1_OWNER_AMBIGUOUS");
  console.log("MFA_FORENSIC_READONLY_COMPLETE_NOT_NATIVE_E2E_PASS");
}
try{inspect()}catch(e){
  const reason=/^BLOCKED_[A-Z0-9_]+$/.test(String(e?.message||""))
    ?e.message:"BLOCKED_MFA_FORENSIC_NONCLASSIFIED";
  console.error("MFA_FORENSIC_NOT_COMPLETE: "+reason);
  process.exitCode=1;
}

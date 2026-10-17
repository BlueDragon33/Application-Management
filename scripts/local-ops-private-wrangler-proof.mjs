// Per-boot, filesystem-scoped secret delivery for disposable and future
// managed Wrangler projects. NEVER place credentials in process argv.
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
const exec = promisify(execFile);

async function secureOwnerOnly(dir,file) {
  await chmod(dir,0o700);
  await chmod(file,0o600);
  if(process.platform==="win32") {
    const {stdout}=await exec("whoami.exe",["/user","/fo","csv","/nh"],
      {windowsHide:true,timeout:6000});
    const sid=stdout.match(/S-\d-\d+(?:-\d+)+/)?.[0];
    if(!sid)throw Error("WIN32_SECRET_SID_UNAVAILABLE");
    await exec("icacls.exe",[dir,"/inheritance:r","/grant:r","*"+sid+":(OI)(CI)F"],
      {windowsHide:true,timeout:10000});
    await exec("icacls.exe",[file,"/inheritance:r","/grant:r","*"+sid+":F"],
      {windowsHide:true,timeout:10000});
  }
}
export async function createPrivateWranglerProof({prefix="managed-wrangler-proof-",bindings={}}={}) {
  if(!/^[a-z0-9-]{3,40}$/i.test(prefix))throw Error("SECRET_DIRECTORY_PREFIX_INVALID");
  const proof=randomBytes(48).toString("base64url");
  if(!bindings || typeof bindings!=="object" || Array.isArray(bindings))
    throw Error("SECRET_BINDINGS_INVALID");
  const lines=['LOCAL_OPS_GATEWAY_REQUIRED="1"',
    "LOCAL_OPS_INGRESS_PROOF="+JSON.stringify(proof)];
  for(const [name,value] of Object.entries(bindings)){
    if(!/^[A-Z][A-Z0-9_]{1,95}$/.test(name) || name.startsWith("LOCAL_OPS_") ||
      typeof value!=="string" || value.length>4096 || /[\r\n\u0000]/.test(value))
      throw Error("SECRET_BINDING_UNSAFE");
    lines.push(name+"="+JSON.stringify(value));
  }
  const dir=await mkdtemp(join(tmpdir(),prefix));
  const file=join(dir,".dev.vars");
  try {
    await writeFile(file,lines.join("\n")+"\n",
      {flag:"wx",mode:0o600});
    await secureOwnerOnly(dir,file);
    return {dir,file,proof,
      // Never include proof in logs, status, argv, or commit artifacts.
      publicStatus:{privateFile:true,proofInArgs:false,proofInEnvironment:false,
        windowsOwnerAclEnforced:process.platform==="win32"},
      cleanup:async()=>rm(dir,{recursive:true,force:true,maxRetries:6,retryDelay:350})};
  }catch(error) {
    await rm(dir,{recursive:true,force:true,maxRetries:6,retryDelay:350});
    throw Error("PRIVATE_WRANGLER_PROOF_CREATION_FAILED",{cause:error});
  }
}
export function assertNoSecretInArgs(args,proof){
  if(!Array.isArray(args)||typeof proof!=="string"||proof.length<32)
    throw Error("SECRET_ARGV_AUDIT_INVALID");
  if(args.some(arg=>String(arg).includes(proof)))throw Error("SECRET_EXPOSED_IN_PROCESS_ARGUMENTS");
  return true;
}

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
export async function createPrivateWranglerProof({prefix="managed-wrangler-proof-"}={}) {
  if(!/^[a-z0-9-]{3,40}$/i.test(prefix))throw Error("SECRET_DIRECTORY_PREFIX_INVALID");
  const dir=await mkdtemp(join(tmpdir(),prefix));
  const file=join(dir,".dev.vars");
  const proof=randomBytes(48).toString("base64url");
  try {
    await writeFile(file,'LOCAL_OPS_GATEWAY_REQUIRED="1"\nLOCAL_OPS_INGRESS_PROOF="'+proof+'"\n',
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

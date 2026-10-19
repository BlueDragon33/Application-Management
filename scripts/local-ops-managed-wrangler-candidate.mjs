// Validated managed Wrangler launch SHAPE, tested with disposable QA Worker.
// Producing a candidate never grants source admission or shutdown permission.
import {realpathSync, readFileSync, statSync} from "node:fs";
import {dirname, join, resolve, sep} from "node:path";
import {createWranglerIngress} from "./local-ops-wrangler-ingress.mjs";
import {assertNoManagedArgvSecrets} from "./local-ops-managed-startup-policy.mjs";
import {requireIssuedPrivateWranglerCredential} from "./local-ops-private-wrangler-proof.mjs";
const SAFE_ENV_KEYS=new Set(["PATH","Path","SystemRoot","SYSTEMROOT","WINDIR","windir",
  "TEMP","TMP","TMPDIR","HOME","USERPROFILE","APPDATA","LOCALAPPDATA",
  "COMSPEC","ComSpec","XDG_CONFIG_HOME","XDG_CACHE_HOME","USER","USERNAME",
  "HOMEDRIVE","HOMEPATH","CI","NO_COLOR"]);
function port(value){if(!Number.isInteger(value)||value<1024||value>65535)
  throw Error("WRANGLER_CANDIDATE_PORT_INVALID");return value;}
export function createManagedWranglerCandidate({projectRoot,configFile,credential,
  persistDir,backendPort,sourceSha=null}={}){
  const issued=requireIssuedPrivateWranglerCredential(credential);
  const {file:privateVarsFile,proof:managedProof}=issued;
  if(!projectRoot||!configFile||!privateVarsFile||!persistDir)
    throw Error("WRANGLER_CANDIDATE_INPUT_MISSING");
  port(backendPort);
  if(typeof managedProof!=="string"||!/^[A-Za-z0-9_-]{40,}$/.test(managedProof))
    throw Error("WRANGLER_CANDIDATE_PROOF_INVALID");
  const root=realpathSync(resolve(projectRoot));
  const cli=realpathSync(join(root,"node_modules","wrangler","bin","wrangler.js"));
  const base=realpathSync(join(root,"node_modules"));
  if(cli!==base&&!cli.startsWith(base+sep))
    throw Error("WRANGLER_CANDIDATE_CLI_NOT_LOCAL");
  const config=realpathSync(resolve(configFile));
  const secretFile=realpathSync(resolve(privateVarsFile));
  if(dirname(config)!==dirname(secretFile)||
     secretFile!==join(dirname(config),".dev.vars"))
    throw Error("WRANGLER_CANDIDATE_SECRET_OUTSIDE_CONFIG");
  const dotenv=readFileSync(secretFile,"utf8");
  if(!dotenv.split(/\r?\n/).includes("LOCAL_OPS_INGRESS_PROOF="+JSON.stringify(managedProof)) ||
     !dotenv.split(/\r?\n/).includes('LOCAL_OPS_GATEWAY_REQUIRED="1"'))
    throw Error("WRANGLER_CANDIDATE_PROOF_FILE_MISMATCH");
  if(process.platform!=="win32" && (statSync(secretFile).mode&0o077)!==0)
    throw Error("WRANGLER_CANDIDATE_SECRET_PERMISSIONS_WEAK");
  // persistDir is required above; resolve() ensures an absolute local path.
  const args=[cli,"dev","--local","--config",config,
    "--ip","127.0.0.1","--port",String(backendPort),
    "--persist-to",resolve(persistDir)];
  assertNoManagedArgvSecrets({managed:true,command:process.execPath,args});
  if(args.join(" ").includes(managedProof))throw Error("WRANGLER_CANDIDATE_PROOF_IN_ARGV");
  const env={};for(const [name,value] of Object.entries(process.env))
    if(SAFE_ENV_KEYS.has(name)&&typeof value==="string")env[name]=value;
  env.CI=env.CI||"1";env.WRANGLER_SEND_METRICS="false";
  const gateway=createWranglerIngress({upstreamPort:backendPort,managedIngressProof:managedProof});
  return {command:process.execPath,args,cwd:dirname(config),env,gateway,
    publicEvidence:{localBinaryVerified:true,proofInArgv:false,
      proofInChildEnvironment:false,gatewayLoopbackOnly:true,
      sourceSha,sourceAdmissionReviewed:false,
      productionShutdownApproved:false,autoRestartAllowed:false}};
}

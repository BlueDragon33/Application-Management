// Blueprint OS 1.3.0 — passive Windows Wrangler CLI shutdown capability probe.
// No Worker, D1, terminal, port or process is started/stopped by this module.
// A CLI exit message is not a nonce/PID/SHA bound graceful shutdown ACK.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const SHA=/^[0-9a-f]{40}$/;
const POSSIBLE_STOP=new Set(['none','node-sigint','node-sigterm','interactive-x',
  'terminal-ctrl-c','api-stop','unknown']);
export const CLI_STOP_PROBE_PROTOCOL='local-ops-wrangler-cli-stop-probe/v1';

export function classifyWranglerCliStop({platform,stopMethod='none'}={}) {
  if(!POSSIBLE_STOP.has(stopMethod))throw Error('UNRECOGNIZED_CLI_STOP_METHOD');
  const reasons=[];
  if(platform!=='win32')reasons.push('WINDOWS_CLI_RUNTIME_NOT_OBSERVED');
  if(stopMethod==='node-sigint'||stopMethod==='node-sigterm')
    reasons.push('NODE_WINDOWS_KILL_IS_ABRUPT_NOT_GRACEFUL');
  else if(stopMethod==='interactive-x'||stopMethod==='terminal-ctrl-c')
    reasons.push('TERMINAL_CONTROL_HAS_NO_VERIFIED_PROCESS_BOUND_ACK');
  else if(stopMethod==='api-stop')
    reasons.push('WRANGLER_API_STOP_IS_NOT_INDEPENDENT_CLI_STOP');
  else reasons.push('NO_DOCUMENTED_VERIFIABLE_CLI_SHUTDOWN_CONTROL');
  return Object.freeze({
    protocol:CLI_STOP_PROBE_PROTOCOL,
    platform,stopMethod,
    verdict:'BLOCKED_NO_AUTHENTICATED_CLI_GRACEFUL_STOP',
    blockers:reasons,
    documentedCliNativeStopAck:false,
    processBoundNoncePidShaReceipt:false,
    allWorkerIsolatesEnumerated:false,
    backgroundWaitUntilAndD1Drained:false,
    independentPersistedReadbackVerified:false,
    windowsDescendantsAndPortsVerified:false,
    sourceOnlyDecision:true,
    cliRuntimeSpawned:false,d1Touched:false,
    cliGracefulStopVerified:false,
    stopAuthorized:false,autoRestartAllowed:false,
    ready:false,ci:'PENDING',
  });
}

export function buildPassiveWindowsProbe({projectRoot,expectedSha,
  platform=process.platform,stopMethod='none'}={}) {
  if(typeof projectRoot!=='string'||!SHA.test(expectedSha??''))
    throw Error('CLI_STOP_PROBE_EXPECTATION_INVALID');
  const root=resolve(projectRoot);
  // read-only HEAD check; --no-optional-locks avoids incidental git lock files.
  const actualSha=execFileSync('git',
    ['--no-optional-locks','-C',root,'rev-parse','HEAD'],
    {encoding:'utf8',windowsHide:true,timeout:6000}).trim();
  if(actualSha!==expectedSha)throw Error('CLI_STOP_PROBE_EXACT_SHA_MISMATCH');
  const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
  const declared=pkg.devDependencies?.wrangler;
  if(typeof declared!=='string'||!/^\d+\.\d+\.\d+$/.test(declared))
    throw Error('WRANGLER_PIN_NOT_EXACT');
  return Object.freeze({...classifyWranglerCliStop({platform,stopMethod}),
    expectedSha,exactShaVerified:true,wranglerDeclaredVersion:declared,
    evidenceKind:'SOURCE_AND_DOCUMENTATION_ONLY_NOT_WINDOWS_RUNTIME_QA',
    noGitHubActionsRequested:true,noDependencyInstall:true,
    noCheckoutMutation:true,noProductionAccess:true});
}

const isEntrypoint=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isEntrypoint) {
  const args=process.argv.slice(2);
  // Any uncontrolled argument or shutdown request is refused by this probe.
  if(args.length!==2||args[0]!=='--expected-sha'){
    console.error('Usage: node scripts/local-ops-wrangler-cli-stop-probe.mjs --expected-sha <40hex>');
    process.exitCode=2;
  }else {
    try {
      const report=buildPassiveWindowsProbe({
        projectRoot:resolve(dirname(fileURLToPath(import.meta.url)),'..'),
        expectedSha:args[1]
      });
      console.log(JSON.stringify(report,null,2));
      // Exit 0 means passive inspection completed. The verdict remains BLOCKED.
    }catch(error) {
      console.error('WRANGLER_CLI_PASSIVE_PROBE_BLOCKED',String(error));
      process.exitCode=1;
    }
  }
}

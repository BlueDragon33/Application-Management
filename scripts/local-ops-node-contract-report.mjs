// Blueprint OS 1.3.0: read an EXISTING Node 22/24 test log, never rerun tests.
// The log-only verdict cannot attest exit code or grant runtime/shutdown authority.
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

 // PowerShell 5's Tee-Object commonly writes UTF-16LE with BOM; Set-Content
 // -Encoding UTF8 commonly writes UTF-8 BOM. Unsupported encodings fail closed.
 export function decodeSavedBuffer(bytes) {
   if(!Buffer.isBuffer(bytes))throw Error('EVIDENCE_BYTES_INVALID');
   if(bytes.length>=2&&bytes[0]===0xff&&bytes[1]===0xfe)
     return bytes.subarray(2).toString('utf16le');
   if(bytes.length>=2&&bytes[0]===0xfe&&bytes[1]===0xff)
     throw Error('EVIDENCE_UTF16BE_UNSUPPORTED');
   const utf8=bytes.length>=3&&bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf;
   const source=utf8?bytes.subarray(3):bytes;
   if(source.includes(0))throw Error('EVIDENCE_ENCODING_UNSUPPORTED');
   return source.toString('utf8');
 }

export function parseNodeTestSummary(log,{expectedTests=7,exitCode=null}={}) {
  if(typeof log!=='string'||!Number.isSafeInteger(expectedTests)||expectedTests<1||
     (exitCode!==null&&(!Number.isInteger(exitCode)||exitCode<0)))
    throw Error('NODE_CONTRACT_REPORT_INPUT_INVALID');
  // TAP: '# tests 7'; Node 24 spec: 'ℹ tests 7', or mojibake 'Γä╣ tests 7'.
  const counts=new Map();
  for(const rawLine of log.replace(/\x1b\[[0-9;]*m/g,'').split(/\r?\n/)) {
    const line=rawLine.replace(/^\uFEFF/,'').trim();
    // Require a short non-ASCII-alphanumeric reporter marker, not free-form prose.
    const match=line.match(/^[^A-Za-z0-9]{0,16}(tests|pass|fail|cancelled|skipped|todo)\s+([0-9]+)\s*$/u);
    if(!match)continue;
    const [,name,value]=match;
    if(counts.has(name))return {verdict:'BLOCKED_AMBIGUOUS_SUMMARY',reason:'DUPLICATE_SUMMARY_FIELD'};
    counts.set(name,Number(value));
  }
  const summary=Object.fromEntries(counts);
  if(!['tests','pass','fail'].every(name=>counts.has(name)))
    return {verdict:'BLOCKED_NO_SUMMARY',reason:'MISSING_TEST_TOTALS',summary};
  if(summary.tests!==expectedTests||summary.pass!==expectedTests||summary.fail!==0||
     ['cancelled','skipped','todo'].some(name=>(summary[name]??0)!==0))
    return {verdict:'BLOCKED_FAILED_OR_INCOMPLETE',reason:'TEST_COUNTS_NOT_ALL_PASS',summary};
  if(exitCode!==null&&exitCode!==0)
    return {verdict:'BLOCKED_NONZERO_EXIT',reason:'NODE_PROCESS_EXIT_NONZERO',summary};
  return {verdict:exitCode===0?'PASS_WITH_RECORDED_EXIT':'PASS_LOG_ONLY',
    reason:exitCode===0?'NODE_EXIT_AND_LOG_CONSISTENT':'NODE_EXIT_CODE_NOT_RECORDED',
    summary,processExitVerified:exitCode===0,qualityGatesElevated:false};
}

export function classifySavedNodeContract({originalReport,log,expectedSha,exitCode=null}) {
  if(!/^[a-f0-9]{40}$/.test(expectedSha??'')||!originalReport||
     originalReport.exactSHA!==expectedSha||originalReport.exactSHAPass!==true||
     originalReport.primaryCheckoutUnchanged!==true)
    return {verdict:'BLOCKED_UNVERIFIED_SOURCE',exactShaVerified:false,
      shutdownAuthorized:false,autoRestartAllowed:false};
  const parsed=parseNodeTestSummary(log,{exitCode});
  return {...parsed,exactShaVerified:true,expectedSha,shutdownAuthorized:false,
    autoRestartAllowed:false,ci:'PENDING',originalReportPreserved:true};
}

// Read-only source inputs; writes ONLY a separate report alongside the evidence.
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]) {
  const [logPath,expectedSha]=process.argv.slice(2);
  if(!logPath||!expectedSha||process.argv.length!==4) {
    console.error('Usage: node scripts/local-ops-node-contract-report.mjs <existing-node-contract.log> <exact-40-sha>');
    process.exitCode=2;
  } else {
    try {
      const originalReport=JSON.parse(decodeSavedBuffer(readFileSync(join(dirname(logPath),'result.json'))));
      const log=decodeSavedBuffer(readFileSync(logPath));
      const report=classifySavedNodeContract({originalReport,log,expectedSha});
      const output={...report,logSha256:createHash('sha256').update(log).digest('hex'),
        evidenceType:'NODE_TEST_LOG_RECLASSIFICATION_NOT_RUNTIME_QA'};
      const dest=join(dirname(logPath),'node-contract-readback.json');
      writeFileSync(dest,JSON.stringify(output,null,2)+'\n',{flag:'wx'}); // never overwrite
      console.log(JSON.stringify({...output,reportPath:dest},null,2));
      if(!output.verdict.startsWith('PASS_'))process.exitCode=1;
    } catch(error) {
      console.error('NODE_CONTRACT_READBACK_BLOCKED',String(error));
      process.exitCode=1;
    }
  }
}

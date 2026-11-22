#requires -Version 5.1
# R0.2 one-run Windows QA package. No Production, no merge, no reviewer A/B.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')]
 [string]$ExpectedBundleSha
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = 'E:\BaumanWeb\Application-Management'
$qa = 'E:\BaumanWeb\_qa'
$main = '89a89ce2d3d8ed634ee9562c52744a99223a2b2a'
$candidate = '92f7fbf6e3b1664d2431694fc5aeaef5b27df5c6'
$runId = 'bundle-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
$reportDir = Join-Path $qa ('_r02_reports\' + $runId)
$summaryFile = Join-Path $reportDir 'bundle-summary.json'
$runnerTemp = Join-Path $env:TEMP ($runId + '.mjs')
$script:stage = 'PRECHECK'
$script:status = 'BLOCKED'
$script:runnerExit = $null
$script:runnerEvidence = $null
$script:events = [System.Collections.Generic.List[object]]::new()
$started = (Get-Date).ToUniversalTime().ToString('o')
$priorConsoleOutputEncoding = [Console]::OutputEncoding
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$attestedAt = $null
$sha414 = $null

function Record-Stage([string]$step) {
 $script:stage = $step
 $script:events.Add(@{ stage=$step; time=(Get-Date).ToUniversalTime().ToString('o') })
 Write-Host ('R02_PACKAGE_STAGE=' + $step)
}
function Invoke-GitChecked([string[]]$GitArgs, [int]$Tries = 1) {
 for ($attempt=1; $attempt -le $Tries; $attempt++) {
  $prior = $ErrorActionPreference
  try {
   $ErrorActionPreference = 'Continue'
   $lines = @(& git.exe -C $repo @GitArgs 2>&1)
   $exit = $LASTEXITCODE
  } finally { $ErrorActionPreference = $prior }
  if ($exit -eq 0) { return @($lines | ForEach-Object { [string]$_ }) }
  $reason = (($lines | Select-Object -Last 12) -join [Environment]::NewLine)
  $transient = $reason -match '(TLS|unexpected eof|timed out|connection reset|Could not resolve host|ECONNRESET|schannel)'
  if (-not $transient -or $attempt -eq $Tries) {
   throw ('GIT_FAILED exit=' + $exit + ' stage=' + $script:stage + ': ' + $reason)
  }
  Start-Sleep -Seconds (2 * $attempt)
 }
}
function Test-Object([string]$Sha) {
 $prior = $ErrorActionPreference
 try {
  $ErrorActionPreference = 'Continue'
  & git.exe -C $repo cat-file -e ($Sha + '^{commit}') 2>$null
  return ($LASTEXITCODE -eq 0)
 } finally { $ErrorActionPreference = $prior }
}
try {
 if (-not (Test-Path -LiteralPath $repo -PathType Container)) { throw 'APP_REPOSITORY_MISSING' }
 foreach ($program in @('git.exe','node.exe','npm.cmd')) {
  if (-not (Get-Command $program -ErrorAction SilentlyContinue)) { throw ('TOOL_MISSING_' + $program) }
 }
 $runtime = (& node.exe --version).Trim()
 if ($LASTEXITCODE -ne 0 -or [version]($runtime.TrimStart('v')) -lt [version]'22.13.0') {
  throw ('NODE_VERSION_UNSUPPORTED_' + $runtime)
 }
 if (Test-Path -LiteralPath $qa) {
  $attributes = (Get-Item -LiteralPath $qa -Force).Attributes
  if ($attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'QA_ROOT_REPARSE_POINT_BLOCKED' }
 }
 [IO.Directory]::CreateDirectory($reportDir) | Out-Null
 [IO.File]::WriteAllText((Join-Path $reportDir 'QA_BUNDLE_OWNERSHIP.txt'),
  $runId,[Text.UTF8Encoding]::new($false))
 Record-Stage 'CANONICAL_REMOTE'
 $origin = (@(Invoke-GitChecked -GitArgs @('remote','get-url','origin')) -join '').Trim()
 if ($origin -notmatch '^(https://github\.com/BlueDragon33/Application-Management(\.git)?|git@github\.com:BlueDragon33/Application-Management(\.git)?)$') {
  throw 'SOURCE_REMOTE_NOT_CANONICAL'
 }
 Record-Stage 'LIVE_SHA_ATTESTATION_ONCE'
 $lines = @(Invoke-GitChecked -GitArgs @(
  'ls-remote','origin','refs/heads/main','refs/pull/414/head','refs/pull/417/head'
 ) -Tries 3)
 $attestedAt = (Get-Date).ToUniversalTime().ToString('o')
 $refs = @{}
 foreach ($line in $lines) {
  if ($line -match '^([a-f0-9]{40})\s+(\S+)$') { $refs[$Matches[2]] = $Matches[1] }
 }
 $shaMain = [string]$refs['refs/heads/main']
 $sha414 = [string]$refs['refs/pull/414/head']
 $sha417 = [string]$refs['refs/pull/417/head']
 if ($shaMain -ne $main) { throw 'MAIN_HEAD_CHANGED_STOP' }
 if ($sha417 -ne $candidate) { throw 'PR417_HEAD_CHANGED_STOP' }
 if ($sha414 -ne $ExpectedBundleSha) { throw 'PR414_BUNDLE_SHA_CHANGED_STOP' }
 Record-Stage 'FETCH_MISSING_PINNED_COMMITS'
 foreach ($item in @(
  @{sha=$shaMain;ref='refs/heads/main'},
  @{sha=$sha414;ref='refs/pull/414/head'},
  @{sha=$sha417;ref='refs/pull/417/head'}
 )) {
  if (-not (Test-Object $item.sha)) {
   $null = @(Invoke-GitChecked -GitArgs @('fetch','--no-tags','origin',$item.ref) -Tries 3)
   if (-not (Test-Object $item.sha)) { throw ('COMMIT_OBJECT_MISSING_' + $item.sha) }
  }
 }
 Record-Stage 'LOAD_VERIFIED_RUNNER'
 $spec = $sha414 + ':scripts/r02-windows-instrumented-qa.mjs'
 $source = @(Invoke-GitChecked -GitArgs @('show',$spec))
 if ($source.Count -lt 300) { throw 'RUNNER_SOURCE_MISSING_OR_TRUNCATED' }
 [IO.File]::WriteAllText($runnerTemp, ($source -join [Environment]::NewLine),
  [Text.UTF8Encoding]::new($false))
 & node.exe --check $runnerTemp
 if ($LASTEXITCODE -ne 0) { throw 'RUNNER_SOURCE_SYNTAX_FAILED' }
 $env:R02_HARNESS_SHA = $sha414
 $env:R02_ATTEST_MAIN = $shaMain
 $env:R02_ATTEST_PR414 = $sha414
 $env:R02_ATTEST_PR417 = $sha417
 $env:R02_ATTESTED_AT = $attestedAt
 $env:R02_APP_REPO = $repo
 $env:R02_QA_ROOT = $qa
 Record-Stage 'RUN_COMPLETE_INSTRUMENTED_QA'
 Write-Host ('R02_START=' + $sha414)
 # The former @(& node.exe ...) buffered stdout until the process completed.
 # Owned log files permit live stage messages and a heartbeat during npm ci.
 $runnerStdout = Join-Path $reportDir 'runner-stdout.log'
 $runnerStderr = Join-Path $reportDir 'runner-stderr.log'
 $nodeExecutable = (Get-Command 'node.exe').Source
 $runnerProcess = Start-Process -FilePath $nodeExecutable -ArgumentList @('"' + $runnerTemp + '"') -WorkingDirectory $repo -RedirectStandardOutput $runnerStdout -RedirectStandardError $runnerStderr -PassThru -NoNewWindow
 $seenLines = 0
 $lastPulse = Get-Date
 $runnerStartedAt = Get-Date
 $lastStage = 'RUNNER_STARTING'
 do {
  Start-Sleep -Seconds 2
  $runnerProcess.Refresh()
  if (Test-Path -LiteralPath $runnerStdout) {
   try {
    $currentLines = @(Get-Content -LiteralPath $runnerStdout -ErrorAction Stop)
    for ($index = $seenLines; $index -lt $currentLines.Count; $index++) {
     $message = [string]$currentLines[$index]
     if ($message -match '^R02_') {
      Write-Host $message
      if ($message -match '^R02_STAGE=(.+)$') { $lastStage = $Matches[1] }
      if ($message -match '^R02_EVIDENCE=(.+\.json)$') { $script:runnerEvidence = $Matches[1] }
     }
    }
    $seenLines = $currentLines.Count
   } catch {
    # The output file can be temporarily locked by the Windows writer.
   }
  }
  if (-not $runnerProcess.HasExited -and ((Get-Date) - $lastPulse).TotalSeconds -ge 20) {
   Write-Host ('R02_PACKAGE_HEARTBEAT=RUNNING;stage=' + $lastStage + ';elapsed_s=' + [int]((Get-Date) - $runnerStartedAt).TotalSeconds)
   $lastPulse = Get-Date
  }
 } while (-not $runnerProcess.HasExited)
 $runnerProcess.WaitForExit()
 $script:runnerExit = [int]$runnerProcess.ExitCode
 if ($script:runnerExit -ne 0) {
  Write-Host ('R02_RUNNER_FAILED_STAGE=' + $lastStage)
  Write-Host ('R02_RUNNER_STDERR=' + $runnerStderr)
  throw ('RUNNER_FAILED_' + $script:runnerExit)
 }
 $script:status = 'MEASURED_NOT_ACCEPTED'
}
catch {
 $errorText = [string]$_.Exception.Message
 $script:events.Add(@{stage=$script:stage;error=$errorText;time=(Get-Date).ToUniversalTime().ToString('o')})
 Write-Host ('R02_PACKAGE_BLOCKER=' + $errorText)
}
finally {
 Remove-Item -LiteralPath $runnerTemp -Force -ErrorAction SilentlyContinue
 [Console]::OutputEncoding = $priorConsoleOutputEncoding
 foreach ($key in @('R02_HARNESS_SHA','R02_ATTEST_MAIN','R02_ATTEST_PR414',
                    'R02_ATTEST_PR417','R02_ATTESTED_AT','R02_APP_REPO','R02_QA_ROOT')) {
  Remove-Item ('Env:\' + $key) -ErrorAction SilentlyContinue
 }
 if (Test-Path -LiteralPath $reportDir) {
  $summary = @{
   schema='application-management.r02.one-run-package/v1'
   status=$script:status
   gate='G05_UNVERIFIED'
   runnerExit=$script:runnerExit
   pinned=@{main=$main;candidate=$candidate;bundle=$sha414}
   attestedAt=$attestedAt
   startedAt=$started
   endedAt=(Get-Date).ToUniversalTime().ToString('o')
   events=@($script:events)
   runnerEvidence=$script:runnerEvidence
   note='Local-only evidence. Never grants merge, deploy, or gate PASS.'
  }
  [IO.File]::WriteAllText($summaryFile,($summary | ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))
  Write-Host ('R02_PACKAGE_SUMMARY=' + $summaryFile)
  $zip = Join-Path $reportDir 'r02-evidence-package.zip'
  try {
   $members = [System.Collections.Generic.List[string]]::new()
   $members.Add($summaryFile)
   foreach ($logFile in @($runnerStdout, $runnerStderr)) {
    if ($logFile -and (Test-Path -LiteralPath $logFile -PathType Leaf)) { $members.Add($logFile) }
   }
   $runnerPath = [string]$script:runnerEvidence
   $rootFull = [IO.Path]::GetFullPath((Join-Path $qa '_r02_reports')) + [IO.Path]::DirectorySeparatorChar
   if ($runnerPath) {
    $full = [IO.Path]::GetFullPath($runnerPath)
    if (-not $full.StartsWith($rootFull,[StringComparison]::OrdinalIgnoreCase)) {
     throw 'RUNNER_EVIDENCE_OUTSIDE_QA_ROOT'
    }
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { throw 'RUNNER_EVIDENCE_JSON_MISSING' }
    $sourceDir = Split-Path -Parent $full
    $targetDir = Join-Path $reportDir 'runner-evidence'
    if ((Get-Item -LiteralPath $sourceDir -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
     throw 'RUNNER_EVIDENCE_REPARSE_POINT_BLOCKED'
    }
    Copy-Item -LiteralPath $sourceDir -Destination $targetDir -Recurse
    $members.Add($targetDir)
   }
   Compress-Archive -LiteralPath $members.ToArray() -DestinationPath $zip -Force
   Write-Host ('R02_PACKAGE_ZIP=' + $zip)
  } catch {
   $zipFailure = [string]$_.Exception.Message
   Write-Host ('R02_PACKAGE_ZIP_BLOCKER=' + $zipFailure)
   $script:status = 'BLOCKED'
  }
 }
 Write-Host ('R02_PACKAGE_RESULT=' + $script:status)
 if ($script:status -ne 'MEASURED_NOT_ACCEPTED') { $global:LASTEXITCODE = 1 }
 else { $global:LASTEXITCODE = 0 }
}

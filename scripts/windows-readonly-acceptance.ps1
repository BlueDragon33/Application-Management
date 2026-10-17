# Blueprint OS 1.3.0 - read-only on-machine Windows acceptance evidence.
# This collector does NOT start/stop services, run SQL, migrate, pull, merge,
# approve a PR, or export secrets, command lines, cookies or response bodies.
[CmdletBinding()]
param(
  [string]$WorkspaceRoot = 'E:\BaumanWeb',
  [string]$ReportDirectory = ''
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
if (-not $ReportDirectory) {
  $ReportDirectory = Join-Path $env:TEMP 'BaumanWeb-ReadOnly-QA'
}
$ErrorActionPreference = 'Stop'
function GitObservation([string]$Directory) {
  $result = [ordered]@{ state = 'UNVERIFIED'; branch = $null; sha = $null; clean = $null }
  if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
    $result.state = 'MISSING_DIRECTORY'
    return $result
  }
  $oldPrompt = $env:GIT_TERMINAL_PROMPT
  $oldOptionalLocks = $env:GIT_OPTIONAL_LOCKS
  try {
    $env:GIT_TERMINAL_PROMPT = '0'
    $env:GIT_OPTIONAL_LOCKS = '0'
    $branch = & git -C $Directory symbolic-ref --quiet --short HEAD 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $branch) { $result.state = 'NOT_MAIN'; return $result }
    $result.branch = [string]$branch
    $sha = & git -C $Directory rev-parse HEAD 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]$sha -notmatch '^[0-9a-fA-F]{40,64}$') {
      $result.state = 'INVALID_SHA'
      return $result
    }
    $result.sha = [string]$sha
    $tracked = & git -C $Directory status --porcelain --untracked-files=no 2>$null
    if ($LASTEXITCODE -ne 0) { $result.state = 'STATUS_UNVERIFIED'; return $result }
    $result.clean = -not [bool]$tracked
    $result.state = if ([string]$branch -ne 'main') { 'NOT_MAIN' } elseif ($result.clean) { 'MAIN_TRACKED_CLEAN' } else { 'TRACKED_DIRTY' }
  } catch {
    $result.state = 'GIT_UNAVAILABLE_OR_BLOCKED'
  } finally {
    $env:GIT_TERMINAL_PROMPT = $oldPrompt
    $env:GIT_OPTIONAL_LOCKS = $oldOptionalLocks
  }
  return $result
}
function PortObservation([int]$Port, [string]$Path) {
  $result = [ordered]@{
    port = $Port; listener = 'UNVERIFIED'; addresses = @(); pids = @()
    processNames = @(); http = 'NOT_PROBED'; httpStatus = $null
  }
  try {
    if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) {
      $result.listener = 'TCP_CMDLET_UNAVAILABLE'
      return $result
    }
    $tcp = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    if ($tcp.Count -eq 0) { $result.listener = 'STOPPED'; return $result }
    $addresses = @($tcp | ForEach-Object { [string]$_.LocalAddress } | Sort-Object -Unique)
    $result.addresses = $addresses
    $pids = @($tcp | ForEach-Object { [int]$_.OwningProcess } | Sort-Object -Unique)
    $result.pids = $pids
    $result.processNames = @($pids | ForEach-Object {
      try { (Get-Process -Id $_ -ErrorAction Stop).ProcessName }
      catch { 'PROCESS_UNKNOWN' }
    })
    if (@($addresses | Where-Object { $_ -notin @('127.0.0.1','::1') }).Count -ne 0) {
      $result.listener = 'NON_LOOPBACK_BIND'
      return $result
    }
    $result.listener = if ($pids.Count -eq 1) { 'LOOPBACK_LISTENER' } else { 'MULTIPLE_OWNERS' }
    if ($result.listener -ne 'LOOPBACK_LISTENER') { return $result }
  } catch {
    $result.listener = 'TCP_OBSERVATION_UNAVAILABLE'
    return $result
  }
  # No redirects, proxy, auth, cookies, response body, or arbitrary URLs.
  if (-not $Path.StartsWith('/') -or $Path.Contains('//') -or $Path.Contains('\')) {
    $result.http = 'UNSAFE_PATH_REFUSED'
    return $result
  }
  $client = $null
  $handler = $null
  try {
    Add-Type -AssemblyName System.Net.Http -ErrorAction Stop
    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.AllowAutoRedirect = $false
    $handler.UseProxy = $false
    $client = New-Object System.Net.Http.HttpClient($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(3)
    $url = 'http://127.0.0.1:' + $Port + $Path
    $response = $client.GetAsync($url, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
    $result.httpStatus = [int]$response.StatusCode
    $result.http = if ($result.httpStatus -ge 200 -and $result.httpStatus -lt 300) {
      'HTTP_2XX_OBSERVED'
    } elseif ($result.httpStatus -ge 300 -and $result.httpStatus -lt 400) {
      'REDIRECT_REFUSED'
    } else { 'HTTP_NOT_READY' }
    $response.Dispose()
  } catch {
    $result.http = 'HTTP_NOT_VERIFIED'
  } finally {
    if ($null -ne $client) { $client.Dispose() }
    if ($null -ne $handler) { $handler.Dispose() }
  }
  return $result
}
$workspace = $WorkspaceRoot.TrimEnd('\','/')
$manager = Join-Path $workspace 'Application-Management'
$manifestFile = Join-Path $manager 'control\local-ops-apps.json'
$observations = @()
$manifestState = 'MISSING_OR_INVALID'
$catalog = @()
if ((Split-Path $workspace -Leaf) -eq 'BaumanWeb' -and (Test-Path -LiteralPath $manifestFile -PathType Leaf)) {
  try {
    $manifest = Get-Content -LiteralPath $manifestFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.agentPort -eq 3011 -and $manifest.apps.Count -ge 7) {
      $manifestState = 'LOADED'
      $catalog = @($manifest.apps)
    }
  } catch { $manifestState = 'INVALID_JSON' }
}
# Report contains ONLY fixed catalog ID, SHA, branch, PID, process name and
# observed HTTP status; no machine username, absolute path or configuration.
$managerGit = GitObservation $manager
$center = PortObservation 3000 '/'
$agent = PortObservation 3011 '/status'
foreach ($app in $catalog) {
  $id = [string]$app.id
  $dir = [string]$app.directory
  if ($id -notmatch '^[a-z0-9-]+$' -or $dir -notmatch '^[a-zA-Z0-9_-]+$') {
    $observations += [ordered]@{ id = 'INVALID_MANIFEST_ENTRY'; capability = 'BLOCKED' }
    continue
  }
  $source = GitObservation (Join-Path $workspace $dir)
  if ($null -eq $app.port) {
    $observations += [ordered]@{ id = $id; capability = 'NON_WEB'; git = $source; runtime = $null }
    continue
  }
  $port = [int]$app.port
  if ($port -lt 3001 -or $port -gt 3010) {
    $observations += [ordered]@{ id = $id; capability = 'INVALID_PORT'; git = $source; runtime = $null }
    continue
  }
  $path = if ($null -ne $app.PSObject.Properties['path'] -and $app.path) {
    [string]$app.path
  } else { '/' }
  $observations += [ordered]@{ id = $id; capability = 'WEB'; git = $source; runtime = (PortObservation $port $path) }
}
$report = [ordered]@{
  protocol = 'BLUEPRINT_WINDOWS_READONLY_ACCEPTANCE_V1'
  observedUtc = [DateTime]::UtcNow.ToString('o')
  shaIsGitSourceOnly = $true
  responseBodyCaptured = $false
  secretsCaptured = $false
  manifest = $manifestState
  manager = [ordered]@{ git = $managerGit; http = $center }
  localAgent = $agent
  apps = $observations
  d1Shutdown = 'BLOCKED_NOT_TESTED'
  review = 'NOT_VERIFIED'
  mergeAuthorization = 'NOT_GRANTED'
  ownerAcceptance = 'UNVERIFIED'
  verdict = 'BLOCKED_NEEDS_HUMAN_REVIEW'
}
New-Item -Path $ReportDirectory -ItemType Directory -Force | Out-Null
$full = Join-Path $ReportDirectory 'latest.json'
$text = Join-Path $ReportDirectory 'latest.txt'
$report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $full -Encoding UTF8
$webCount = @($observations | Where-Object { $_.capability -eq 'WEB' }).Count
$liveCount = @($observations | Where-Object {
  $_.capability -eq 'WEB' -and $_.runtime.http -eq 'HTTP_2XX_OBSERVED'
}).Count
@(
  'BLUEPRINT OS 1.3.0 - WINDOWS READ-ONLY QA'
  'Verdict: BLOCKED_NEEDS_HUMAN_REVIEW (not product acceptance)'
  ('Manager Git SHA: ' + $managerGit.sha)
  ('Manager Git state: ' + $managerGit.state)
  ('Manager HTTP: ' + $center.http)
  ('Local Agent: ' + $agent.listener)
  ('Web apps with observed loopback HTTP 2xx: ' + $liveCount + '/' + $webCount)
  'D1 shutdown: BLOCKED_NOT_TESTED'
  'No merge, no publish, no secrets, no process changes.'
  'Full structured report: latest.json'
) | Set-Content -LiteralPath $text -Encoding UTF8
Write-Output 'READ_ONLY_QA_COLLECTED; ACCEPTANCE_NOT_GRANTED'
Write-Output ('Report: ' + $text)

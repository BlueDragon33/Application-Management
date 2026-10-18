# PR #360 — isolated Windows candidate source QA

Creates an independent temp Git clone rather than a git worktree. No existing BaumanWeb repo, D1 or existing TCP listener is changed.

Two files are required, placed in one folder: QA_PR360_CANDIDATE.vbs and candidate-pr360-isolated-qa.mjs. Double-click VBS. Node and Git plus GitHub network access are required; no PowerShell or Administrator required. Do not supply credentials to ChatGPT.

The script checks original E:\BaumanWeb\Application-Management clean main SHA 93906a7fff0f3925139ab63dc01312e8d18caf17, records existing 3000, 3011, 3188 listeners, and clones original repo with git clone --no-local --no-checkout into unique OS temp. It fetches refs/pull/360/head from fixed GitHub URL using only allowed protocols, verifies PR SHA descends from e2f49126abbab90597fafd860595dad580472998, checks out detached candidate in the temp clone, and verifies key Offline-First source modules. Checks original HEAD and listener census again after.

Report path: %TEMP%\BaumanWeb-PR360-Candidate-QA\latest.json. Candidate clone remains under a unique temporary directory for future isolated follow-up, but report omits machine paths and secrets.

Candidate source-only success returns SOURCE_PREPARED_RUNTIME_BLOCKED and records the exact Git SHA. It is NOT an application/UI/HTTP test, does not allocate port 3188, never starts 3000/3011, never accesses real D1 and never proves shutdown. Every report retains runtime NOT_STARTED, D1 BLOCKED_NOT_TESTED, review NOT_VERIFIED and mergeAuthorization NOT_GRANTED. Independent human review and genuine disposable runtime tests remain prerequisites for merge; do not run unpublished draft on live owner ports.
// Pure parser for user-selected read-only audit JSON. No network, persistence, shell or trust grants.
export const RISK_ORDER = Object.freeze({
  PRIVATE_AUTO_REVIEW: 0,
  UNKNOWN_TRIGGER_REVIEW: 1,
  UNKNOWN_RUNNER_REVIEW: 2,
  POTENTIAL_BILLING_REVIEW: 3,
  SELF_HOSTED_SECURITY_REVIEW: 4,
  MANUAL_NOT_COST_FREE: 5,
  PUBLIC_STANDARD_CANDIDATE: 6,
});
const STATUS = new Set(["STATIC_LOCAL_AUDIT_ONLY", "NOT_CHECKED_LOCAL_REPO_MISSING"]);
const RISK = new Set(Object.keys(RISK_ORDER));
const platform = new Set(["macos", "windows", "ubuntu", "self-hosted"]);
const repoName = /^[A-Za-z0-9_.-]{1,110}$/;
const fileName = /^[a-zA-Z0-9_.-]{1,200}\.ya?ml$/i;
function fail(reason) { throw new Error("BLOCKED_INVALID_AUDIT: " + reason); }

export function parseZeroSpendReport(input) {
  const value = typeof input === "string" ? JSON.parse(input) : input;
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("object expected");
  if (value.schema !== "blueprint-os/local-zero-spend-candidate/v1" ||
      value.status !== "NOT_RATIFIED" ||
      value.billingNotVerifiedLive !== true ||
      value.sourceSHAReadback !== false) fail("unexpected scope or authority");
  if (!Array.isArray(value.repositories) || value.repositories.length > 100 ||
      value.repositories.length < 1) fail("repositories missing or over limit");
  if (!Number.isInteger(value.inventoryCount) ||
      value.inventoryCount !== value.repositories.length) fail("inventory count mismatch");
  const names = new Set();
  let scanned = 0, workflowCount = 0, unchecked = 0;
  const rows = value.repositories.map(repo => {
    if (!repo || typeof repo !== "object" || !repoName.test(repo.repository) ||
        !STATUS.has(repo.status) || !Array.isArray(repo.workflows) ||
        repo.workflows.length > 300 || names.has(repo.repository.toLowerCase())) fail("invalid/duplicate repository");
    names.add(repo.repository.toLowerCase());
    if (repo.status === "NOT_CHECKED_LOCAL_REPO_MISSING") {
      if (repo.workflows.length) fail("missing local clone cannot have inspected workflows");
      unchecked++;
      return { name: repo.repository, status: repo.status, risk: "NOT_CHECKED", workflows: [] };
    }
    if (!["public", "private"].includes(repo.visibility)) fail("unknown source visibility");
    scanned++;
    const files = new Set();
    const workflows = repo.workflows.map(w => {
      if (!w || typeof w !== "object" || !fileName.test(w.file) ||
          files.has(w.file) || !RISK.has(w.risk) ||
          !Array.isArray(w.events) || w.events.length > 30 ||
          !w.events.every(e => typeof e === "string" && /^[a-z_]{2,40}$/.test(e)) ||
          !Array.isArray(w.runnerTypes) ||
          !w.runnerTypes.every(t => platform.has(t)) ||
          w.ciExecuted !== false || w.costUnknown !== true) fail("unverified or invalid workflow metadata");
      files.add(w.file);
      workflowCount++;
      return {file: w.file, risk: w.risk, events: w.events, runnerTypes: w.runnerTypes};
    });
    const risk = workflows.reduce((acc, w) =>
      RISK_ORDER[w.risk] < RISK_ORDER[acc] ? w.risk : acc, "PUBLIC_STANDARD_CANDIDATE");
    return {name: repo.repository, status: repo.status, visibility: repo.visibility,
      risk: workflows.length ? risk : "NO_WORKFLOWS_FOUND", workflows};
  });
  if (value.scanned !== scanned || value.workflowCount !== workflowCount) fail("local summary mismatch");
  if (value.githubHostedMinutesConsumedByAudit !== 0) fail("audit must not invoke hosted runners");
  rows.sort((a,b) =>
    (a.risk === "NOT_CHECKED" ? 0 : RISK_ORDER[a.risk] ?? 7) -
    (b.risk === "NOT_CHECKED" ? 0 : RISK_ORDER[b.risk] ?? 7) ||
    a.name.localeCompare(b.name));
  return {scope:"STATIC_OWNER_SUPPLIED_REPORT_UNVERIFIED",inventoryCount:rows.length,scanned,
    workflowCount,unchecked,rows};
}

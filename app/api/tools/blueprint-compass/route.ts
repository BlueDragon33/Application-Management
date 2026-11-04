import { getChatGPTUser } from "../../../chatgpt-auth";
import { projectRepositories } from "../../../project-registry";
import { compassAssessment, isAllowedRepository, normalizeGitHubListing } from "../../../blueprint-compass-core.mjs";

export const dynamic = "force-dynamic";
const JSON_HEADERS = { "cache-control": "no-store, private", "x-content-type-options": "nosniff" };
const GITHUB_HEADERS = {
  accept: "application/vnd.github+json",
  "user-agent": "Application-Management-Blueprint-Compass",
  "x-github-api-version": "2022-11-28",
};
function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: JSON_HEADERS });
}

/** No GitHub mutation, no token, no production/release capability. */
export async function GET(request: Request) {
  const actor = await getChatGPTUser();
  if (!actor) return response({ ok: false, status: "UNAUTHORIZED" }, 401);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const entry = projectRepositories.find(project => project.id === id);
  const registered = projectRepositories.map(project => project.repository);
  if (!entry || !isAllowedRepository(entry.repository, registered))
    return response({ ok: false, status: "UNKNOWN_PROJECT" }, 400);

  // All outgoing destinations are derived from the local allowlisted registry, never raw input.
  const base = `https://api.github.com/repos/${entry.repository}`;
  const read = async (url: string): Promise<unknown> => {
    const upstream = await fetch(url, {
      method: "GET", headers: GITHUB_HEADERS, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(8500),
    });
    if (!upstream.ok) throw new Error(`GitHub HTTP ${upstream.status}`);
    return upstream.json();
  };
  try {
    const [repo, pulls, issues] = await Promise.all([
      read(base), read(`${base}/pulls?state=open&per_page=20`),
      read(`${base}/issues?state=open&per_page=20`),
    ]);
    const metadata = repo as { default_branch?: unknown; full_name?: unknown };
    if (typeof metadata?.full_name !== "string"
      || metadata.full_name.toLowerCase() !== entry.repository.toLowerCase())
      throw new Error("GitHub metadata không trùng repository đã chọn.");
    if (!Array.isArray(pulls) || !Array.isArray(issues))
      throw new Error("Danh sách PR/Issue GitHub không hợp lệ.");
    const branch = typeof metadata?.default_branch === "string" ? metadata.default_branch : "";
    if (!branch || !/^[A-Za-z0-9._/-]{1,150}$/.test(branch))
      throw new Error("Không xác minh được default branch GitHub.");
    const commit = await read(`${base}/commits/${encodeURIComponent(branch)}`) as { sha?: unknown };
    const head = typeof commit?.sha === "string" ? commit.sha : "";
    if (!/^[0-9a-f]{40}$/.test(head))
      throw new Error("Không xác minh được HEAD GitHub.");
    const pullRequests = normalizeGitHubListing(pulls, "pull", 20, entry.repository);
    const openIssues = normalizeGitHubListing(issues, "issue", 20, entry.repository);
    const verdict = compassAssessment({ head, pullRequests, issues: openIssues });
    return response({
      ok: true, source: "github-public-rest", checkedAt: new Date().toISOString(),
      projectId: entry.id, repository: entry.repository, branch,
      head: /^[0-9a-f]{40}$/.test(head) ? head : null,
      pullRequests, issues: openIssues, verdict,
      evidenceClass: "UNSIGNED_GITHUB_METADATA_ONLY",
      canonicalGateVerified: false, humanReviewVerified: false,
      limitations: "GitHub chỉ hiển thị tối đa 20 PR/Issue mỗi loại; không thay WorkPackage, QA Gate hoặc reviewer authority canonical trong Hub.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub read failed";
    return response({ ok: false, status: "UNVERIFIED", projectId: entry.id,
      repository: entry.repository, error: message,
      verdict: compassAssessment({ head: "" }),
    }, 502);
  }
}

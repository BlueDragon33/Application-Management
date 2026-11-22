import { getChatGPTUser } from "../../../../chatgpt-auth";
import { assessHubGraphContract } from "../../../../blueprint-hub-graph-contract.mjs";

export const dynamic = "force-dynamic";
const HUB = "BlueDragon33/Software-Blueprint-Hub";
const API = "https://api.github.com/repos/" + HUB;
const SHA = /^[0-9a-f]{40}$/;
const HEADERS = { "cache-control": "no-store, private", "x-content-type-options": "nosniff" };
const GITHUB_HEADERS = {
  accept: "application/vnd.github+json",
  "user-agent": "Application-Management-Blueprint-Graph-Contract",
  "x-github-api-version": "2022-11-28",
};

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: HEADERS });
}

/** C21: source-pin GitHub public contract; NEVER fetch a private Graph API via arbitrary contract URLs. */
async function readGitHub(url: string): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET", headers: GITHUB_HEADERS,
    cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(8500),
  });
  if (!response.ok || response.redirected || response.status >= 300 && response.status < 400)
    throw new Error("HUB_GITHUB_READ_UNVERIFIED");
  return response.json();
}

/** All outputs deny Graph read/QA/release authority. This endpoint never emits canonical graph nodes. */
export async function GET() {
  if (!await getChatGPTUser()) return reply({ ok: false, status: "UNAUTHORIZED", canReadGraph: false }, 401);
  try {
    const commit = await readGitHub(API + "/commits/main") as { sha?: unknown };
    if (typeof commit?.sha !== "string" || !SHA.test(commit.sha)) throw new Error("HUB_SHA_UNVERIFIED");

    // Fetch contract bytes at the EXACT immutable commit, never an unpinned mutable main ref.
    const remote = await readGitHub(
      API + "/contents/control/application-management.contract.json?ref=" + commit.sha,
    ) as { type?: unknown; path?: unknown; encoding?: unknown; content?: unknown; sha?: unknown };
    if (remote?.type !== "file" || remote?.path !== "control/application-management.contract.json"
      || remote?.encoding !== "base64" || typeof remote.content !== "string"
      || remote.content.length > 200_000 || typeof remote.sha !== "string" || !SHA.test(remote.sha))
      throw new Error("HUB_CONTRACT_UNVERIFIED");

    const base64 = remote.content.replace(/\s/g, "");
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64))
      throw new Error("HUB_CONTRACT_ENCODING_UNVERIFIED");
    const decoded = Uint8Array.from(atob(base64), value => value.charCodeAt(0));
    const contract: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decoded));
    const admission = assessHubGraphContract(contract, commit.sha, remote.sha, new Date().toISOString());
    return reply(admission, admission.ok ? 200 : 502);
  } catch {
    return reply({
      ok: false, status: "UNVERIFIED", repository: HUB, canReadGraph: false,
      canWriteWorkPackages: false, qaPassed: false, productionAuthorized: false,
      note: "Không xác minh được HEAD/contract Hub từ GitHub. Không tự suy ra đang kết nối hoặc PASS.",
    }, 502);
  }
}

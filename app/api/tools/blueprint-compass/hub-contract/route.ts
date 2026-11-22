import { getChatGPTUser } from "../../../../chatgpt-auth";

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
    const contract = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decoded)) as {
      schema?: unknown; protocol?: unknown; contractVersion?: unknown;
      application?: { repository?: unknown };
      policy?: {
        metadataOnly?: unknown; applicationManagementMayMutateCanonicalBlueprintState?: unknown;
        applicationManagementMayPassQualityGates?: unknown;
        applicationManagementMayAuthorizeProductionRelease?: unknown;
      };
      endpoints?: unknown;
    };
    if (contract?.schema !== "application-management.contract/v1"
      || contract.protocol !== "blueprint-os-compass-metadata-v1"
      || contract.contractVersion !== 1
      || contract.application?.repository !== HUB
      || !contract.policy || contract.policy.applicationManagementMayMutateCanonicalBlueprintState !== false
      || contract.policy.applicationManagementMayPassQualityGates !== false
      || contract.policy.applicationManagementMayAuthorizeProductionRelease !== false
      || !contract.endpoints || Array.isArray(contract.endpoints)
      || typeof contract.endpoints !== "object") throw new Error("HUB_CONTRACT_INCOMPATIBLE");

    const metadataOnly = contract.policy.metadataOnly === true;
    const endpoints = Object.keys(contract.endpoints);
    const status = metadataOnly && endpoints.length === 0
      ? "HUB_GRAPH_NOT_EXPOSED"
      : "HUB_GRAPH_AUTH_NOT_ESTABLISHED";
    return reply({
      ok: true, status,
      repository: HUB, hubHead: commit.sha, contractBlobSha: remote.sha,
      contractSchema: "application-management.contract/v1",
      contractVersion: 1,
      source: "github-public-rest-pinned-contract",
      checkedAt: new Date().toISOString(),
      canReadGraph: false, canWriteWorkPackages: false,
      qaPassed: false, productionAuthorized: false,
      note: metadataOnly && endpoints.length === 0
        ? "Hub mới cấp contract metadata-only; chưa có endpoint Graph được xác thực."
        : "Contract khác metadata-only. Cần kiểm duyệt quyền/identity và contract versioned trước khi cấp Graph read.",
    });
  } catch {
    return reply({
      ok: false, status: "UNVERIFIED", repository: HUB, canReadGraph: false,
      canWriteWorkPackages: false, qaPassed: false, productionAuthorized: false,
      note: "Không xác minh được HEAD/contract Hub từ GitHub. Không tự suy ra đang kết nối hoặc PASS.",
    }, 502);
  }
}

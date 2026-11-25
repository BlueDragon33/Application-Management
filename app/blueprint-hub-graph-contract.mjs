/** Read-only, fail-closed admission of the Hub PUBLIC metadata contract.
 * This is never permission to fetch canonical Graph or to mutate WorkPackage.
 */
const SHA = /^[0-9a-f]{40}$/;
const HUB = "BlueDragon33/Software-Blueprint-Hub";

export function assessHubGraphContract(contract, hubHead, contractBlobSha, checkedAt) {
  if (typeof hubHead !== "string" || !SHA.test(hubHead)
    || typeof contractBlobSha !== "string" || !SHA.test(contractBlobSha)
    || !contract || typeof contract !== "object" || Array.isArray(contract)
    || contract.schema !== "application-management.contract/v1"
    || contract.protocol !== "blueprint-os-compass-metadata-v1"
    || contract.contractVersion !== 1
    || contract.application?.repository !== HUB
    || !contract.policy || typeof contract.policy !== "object"
    || contract.policy.applicationManagementMayMutateCanonicalBlueprintState !== false
    || contract.policy.applicationManagementMayPassQualityGates !== false
    || contract.policy.applicationManagementMayAuthorizeProductionRelease !== false
    || !contract.endpoints || typeof contract.endpoints !== "object"
    || Array.isArray(contract.endpoints)) {
    return Object.freeze({
      ok: false, status: "UNVERIFIED", repository: HUB,
      canReadGraph: false, canWriteWorkPackages: false,
      qaPassed: false, productionAuthorized: false,
      note: "Schema/quyền hoặc SHA Hub không hợp lệ; phải kiểm tra contract trước khi kết nối.",
    });
  }

  const endpoints = Object.keys(contract.endpoints);
  const metadataOnly = contract.policy.metadataOnly === true;
  return Object.freeze({
    ok: true,
    status: metadataOnly && endpoints.length === 0
      ? "HUB_GRAPH_NOT_EXPOSED"
      : "HUB_GRAPH_AUTH_NOT_ESTABLISHED",
    repository: HUB,
    hubHead, contractBlobSha,
    contractSchema: "application-management.contract/v1",
    contractVersion: 1,
    source: "github-public-rest-pinned-contract",
    checkedAt: typeof checkedAt === "string" && checkedAt.length < 100 ? checkedAt : null,
    canReadGraph: false, canWriteWorkPackages: false,
    qaPassed: false, productionAuthorized: false,
    note: metadataOnly && endpoints.length === 0
      ? "Hub mới cấp contract metadata-only; chưa có endpoint Graph được xác thực."
      : "Contract khác metadata-only. Cần kiểm duyệt quyền/identity và contract versioned trước khi cấp Graph read.",
  });
}

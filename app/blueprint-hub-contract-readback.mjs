/** Fail-closed projection of one authenticated, read-only Hub contract HTTP reply.
 * A public GitHub contract is metadata, never authorization to read canonical Graph.
 */
const SHA = /^[0-9a-f]{40}$/;
const HUB = "BlueDragon33/Software-Blueprint-Hub";
const READY = new Set(["HUB_GRAPH_NOT_EXPOSED", "HUB_GRAPH_AUTH_NOT_ESTABLISHED"]);

function unverified() {
  return Object.freeze({
    ok: false, status: "UNVERIFIED", canReadGraph: false,
    note: "Không xác minh được trả lời contract Hub; tuyệt đối không suy ra Graph đã kết nối.",
  });
}

export function validateHubContractReadback(input, httpStatus) {
  if (!input || typeof input !== "object" || Array.isArray(input)
    || input.canReadGraph !== false || typeof input.ok !== "boolean"
    || !Number.isInteger(httpStatus)) return unverified();

  if (httpStatus === 401 && input.ok === false && input.status === "UNAUTHORIZED")
    return Object.freeze({
      ok: false, status: "UNAUTHORIZED", canReadGraph: false,
      note: "Phiên đăng nhập không còn hợp lệ; không có quyền đọc contract.",
    });

  if (httpStatus === 502 && input.ok === false && input.status === "UNVERIFIED")
    return unverified();

  if (httpStatus !== 200 || input.ok !== true || !READY.has(input.status)
    || input.repository !== HUB || input.source !== "github-public-rest-pinned-contract"
    || typeof input.hubHead !== "string" || !SHA.test(input.hubHead)
    || typeof input.contractBlobSha !== "string" || !SHA.test(input.contractBlobSha)
    || input.contractSchema !== "application-management.contract/v1"
    || input.contractVersion !== 1
    || input.canWriteWorkPackages !== false || input.qaPassed !== false
    || input.productionAuthorized !== false
    || typeof input.checkedAt !== "string" || input.checkedAt.length > 64
    || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(input.checkedAt)
    || !Number.isFinite(Date.parse(input.checkedAt))) return unverified();

  return Object.freeze({
    ok: true,
    status: input.status,
    repository: HUB,
    hubHead: input.hubHead,
    contractBlobSha: input.contractBlobSha,
    contractSchema: "application-management.contract/v1",
    checkedAt: input.checkedAt,
    canReadGraph: false,
    note: input.status === "HUB_GRAPH_NOT_EXPOSED"
      ? "Hub mới công bố metadata-only: chưa có endpoint Graph canonical được cấp quyền."
      : "Contract cần tiếp tục xác minh quyền/identity; chưa được phép đọc Graph canonical.",
  });
}

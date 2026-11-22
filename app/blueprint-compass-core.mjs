const SHA = /^[0-9a-f]{40}$/;
const LABEL_BLOCKED = /^(?:blocked|review.blocked|needs-human|needs-approval|security-blocked)$/i;

/** Issue labels are untrusted human-readable signals, not signed canonical decisions. */
function pullHead(pr) {
  return typeof pr?.headSha === "string" && SHA.test(pr.headSha) ? pr.headSha : null;
}

/** Advisory-only projection. GitHub issue/PR listing is not canonical gate evidence. */
export function compassAssessment(input) {
  const head = typeof input?.head === "string" ? input.head : "";
  const prs = Array.isArray(input?.pullRequests) ? input.pullRequests : [];
  const issues = Array.isArray(input?.issues) ? input.issues : [];
  if (!SHA.test(head)) return Object.freeze({
    status: "UNVERIFIED", priority: "verify-source",
    title: "Chưa xác minh mã nguồn",
    description: "Không có SHA GitHub hợp lệ. Chưa được phép kết luận dự án đã sẵn sàng.",
    nextStep: "Kiểm tra HEAD trực tiếp trên GitHub trước khi xác định việc tiếp theo.",
    qaPassed: false, productionAuthorized: false,
  });
  const blocked = issues.find(issue => Array.isArray(issue.labels)
    && issue.labels.some(label => LABEL_BLOCKED.test(label)));
  if (blocked) return Object.freeze({
    status: "BLOCKER_SIGNAL_UNVERIFIED", priority: "verify-blocker",
    title: "Phát hiện nhãn Issue cần kiểm tra", description: `Issue #${blocked.number} có nhãn cảnh báo do GitHub cung cấp; nhãn không chứng minh cổng review canonical đã BLOCKED.`,
    nextStep: `Mở Issue #${blocked.number}, đối chiếu WorkPackage, quyền và bằng chứng từ Hub trước khi xác định blocker.`,
    qaPassed: false, productionAuthorized: false,
  });
  const draft = prs.find(pr => pr.draft === true);
  if (draft) return Object.freeze({
    status: "DRAFT_REVIEW", priority: "source-review",
    title: "Có Draft PR cần xử lý", description: `PR #${draft.number} đang ở trạng thái Draft, không đồng nghĩa đã nghiệm thu.`,
    nextStep: `Đối chiếu diff PR #${draft.number} với SHA ${pullHead(draft) ?? "PR_HEAD_UNVERIFIED"}, xác minh bằng chứng rồi chuyển reviewer độc lập khi đủ điều kiện.`,
    qaPassed: false, productionAuthorized: false,
  });
  if (prs.length) return Object.freeze({
    status: "REVIEW_PENDING", priority: "independent-review",
    title: "Có Pull Request đang mở", description: `Đã thấy ${prs.length} PR mở trong giới hạn dữ liệu tải về; chưa xác minh human approval.`,
    nextStep: `Kiểm tra PR #${prs[0].number} tại SHA ${pullHead(prs[0]) ?? "PR_HEAD_UNVERIFIED"}, requested reviewers và QA thực trước khi cân nhắc bước tiếp.`,
    qaPassed: false, productionAuthorized: false,
  });
  if (issues.length) return Object.freeze({
    status: "ISSUE_TRIAGE", priority: "plan",
    title: "Có Issue cần phân loại", description: `Có ${issues.length} Issue trong phạm vi tải; chưa xác minh WorkPackage canonical.`,
    nextStep: `Mở Issue #${issues[0].number}, so khớp WorkPackage/Hiến pháp từ Hub rồi lập phạm vi xử lý.`,
    qaPassed: false, productionAuthorized: false,
  });
  return Object.freeze({
    status: "NO_OPEN_ITEMS_IN_SAMPLE", priority: "inspect-canonical",
    title: "Chưa thấy việc mở trong mẫu GitHub", description: "Danh sách được giới hạn; không chứng minh đã hoàn thành hoặc PASS Quality Gate.",
    nextStep: "Kiểm tra WorkPackage canonical trong Hub và các nhánh/PR ngoài danh sách đã tải.",
    qaPassed: false, productionAuthorized: false,
  });
}

/** Parser excludes PRs embedded in GitHub's issues endpoint; result is never a QA receipt. */
export function normalizeGitHubListing(rows, kind, limit = 20, repository = null) {
  // An expected repository must match the row URL exactly; never accept links to a different repo.
  if (repository !== null && (typeof repository !== "string" || !/^BlueDragon33\/[A-Za-z0-9_.-]+$/.test(repository))) return [];
  if (!Array.isArray(rows)) return [];
  const safeLimit = Number.isInteger(limit) ? Math.max(0, Math.min(limit, 50)) : 20;
  return rows.filter(row => row && typeof row === "object"
    && Number.isSafeInteger(row.number) && row.number > 0
    && typeof row.html_url === "string" && /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/(?:pull|issues)\/\d+$/.test(row.html_url)
    && (kind === "pull" ? row.html_url.includes("/pull/") : row.html_url.includes("/issues/"))
    && (repository === null || row.html_url.startsWith(`https://github.com/${repository}/`))
    && (kind !== "issue" || !row.pull_request))
    .slice(0, safeLimit).map(row => ({
      number: row.number, title: typeof row.title === "string" ? row.title.slice(0, 180) : "(Không có tiêu đề)",
      url: row.html_url, draft: kind === "pull" ? row.draft === true : false,
      headSha: kind === "pull" && typeof row.head?.sha === "string" && SHA.test(row.head.sha) ? row.head.sha : null,
      labels: Array.isArray(row.labels) ? row.labels
        .map(label => typeof label?.name === "string" ? label.name : "").filter(Boolean).slice(0, 20) : [],
    }));
}

export function isAllowedRepository(value, registered) {
  return typeof value === "string"
    && /^BlueDragon33\/[A-Za-z0-9_.-]+$/.test(value)
    && Array.isArray(registered) && registered.includes(value);
}

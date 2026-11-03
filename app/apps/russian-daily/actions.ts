"use server";

import { requireChatGPTUser } from "../../chatgpt-auth";
import { getApplicationConfig } from "../../application-registry";

export type ActiveNextActionStep = {
  key: string;
  title: string;
  result: "PASS" | "BLOCKED" | "NOT_VERIFIED";
  evidence: string;
};

export type RussianDailyActiveRunReceipt = {
  actionId: "RD-ACTIVE-E2E-PREFLIGHT-V1";
  projectId: "project:bauman-russian-ios";
  sourceRevision: string;
  observedAt: string;
  status: "BLOCKED_PROVIDER_AUTH" | "BLOCKED_SOURCE_MISMATCH";
  steps: ActiveNextActionStep[];
  oneNextAction: string;
  hasDeployedSite: false;
  grantedPrivileges: false;
  developerApproval: false;
};

const SOURCE_REVISION = "de9b865e19df52ee5a84d59e94ea541328b1e690";

/**
 * One-click bounded executor: automatically evaluates all admitted read-only
 * stages and returns a complete receipt. No user prompt loop or redirect.
 *
 * Important: this Cloudflare app has no proven authorized Vercel/GitHub private
 * repository executor or issuer grant. It MUST NOT fabricate a deployment,
 * real CI, quota evidence or independent reviewer authorization.
 */
export async function runRussianDailyActiveNextAction(): Promise<RussianDailyActiveRunReceipt> {
  await requireChatGPTUser("/apps/russian-daily");
  const observedAt = new Date().toISOString();
  const steps: ActiveNextActionStep[] = [];
  steps.push({key:"auth",title:"1. Xác minh phiên quản trị",result:"PASS",
    evidence:"requireChatGPTUser đã xác thực phiên cho đúng route. Không suy ra quyền reviewer hay deploy."});
  const application = getApplicationConfig("russian-daily");
  const sourceCorrect = application?.repository === "BlueDragon33/Bauman-Russian-iOS" &&
    application?.id === "russian-daily" && application?.tier === "client";
  steps.push({key:"source",title:"2. Đối chiếu ứng dụng và mã nguồn",result:sourceCorrect?"PASS":"BLOCKED",
    evidence:sourceCorrect?"Danh mục nội bộ đúng repository. SHA mục tiêu "+SOURCE_REVISION.slice(0,12)+
      " chỉ là SHA đã ghi nhận; chưa phải readback GitHub tại thời điểm chạy.":
      "Danh mục không khớp repository hoặc định danh dự kiến."});
  const independent = sourceCorrect && application?.contractState !== "connected" &&
    !application?.publicUrl && !application?.previewUrl;
  steps.push({key:"runtime",title:"3. Kiểm tra trạng thái runtime độc lập",
    result:independent?"PASS":"BLOCKED",
    evidence:independent?"Đã xác định ứng dụng còn pending và không giả URL; App-Management không sở hữu runtime.":
       "Trạng thái phát hành đã khác dự kiến; yêu cầu đọc lại chứng cứ trước khi thực thi."});
  steps.push({key:"zero-spend",title:"4. Cổng ZERO-SPEND / Vercel Hobby",
    result:"NOT_VERIFIED",
    evidence:"Không có kết nối Vercel được xác thực trong runtime, không thể đọc plan/quota/billing hoặc bảo vệ Preview. Không tạo project, không gọi API trả phí."});
  steps.push({key:"deployment",title:"5. Tự động hóa Preview có kiểm soát",
    result:"BLOCKED",
    evidence:"Không có executor được issuer cấp quyền, không có Vercel project ID hoặc exact-SHA Preview readback. Không tự thay production branch, merge hay publish."});
  steps.push({key:"release",title:"6. Kiểm tra gate review và Production",
    result:"BLOCKED",
    evidence:"Chưa có reviewer độc lập và Safari QA thực tế được xác minh trên runtime này. Giữ REVIEW BLOCKED / Production BLOCKED."});
  return {
    actionId:"RD-ACTIVE-E2E-PREFLIGHT-V1",
    projectId:"project:bauman-russian-ios",
    sourceRevision:SOURCE_REVISION,
    observedAt,
    status:sourceCorrect && independent?"BLOCKED_PROVIDER_AUTH":"BLOCKED_SOURCE_MISMATCH",
    steps,
    oneNextAction:sourceCorrect && independent?
      "Cấp kết nối Vercel Hobby và issuer grant Preview scoped thực cho repository/commit mục tiêu; sau đó mới thêm executor triển khai và readback.":
      "Kiểm tra lại source catalog / trạng thái quản lý trước khi cấp bất kỳ quyền thực thi nào.",
    hasDeployedSite:false,
    grantedPrivileges:false,
    developerApproval:false
  };
}

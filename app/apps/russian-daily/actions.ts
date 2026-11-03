"use server";

import { requireChatGPTUser } from "../../chatgpt-auth";
import { getApplicationConfig } from "../../application-registry";

/**
 * Candidate pilot of Blueprint OS 1.3.0 contextual next-action guidance.
 * Authenticating the user does NOT give ProjectProfile PROJECT_READ or workflow
 * execution authority. No privileged operation may be implied.
 */
export type RussianDailyNextActionReceipt = {
  actionId: "RD-HOBBY-PREFLIGHT";
  kind: "PERSONAL_PROVIDER_READONLY_NAVIGATION";
  projectId: "project:bauman-russian-ios";
  sourceRevision: string;
  status: "SAFE_NAVIGATION_ONLY";
  providerUrl: "https://vercel.com/account";
  reason: string;
  evidenceNeeded: string;
  blockedBy: string;
  privilegedExecution: false;
  projectAuthority: "UNVERIFIED";
};

export async function prepareRussianDailyNextAction(): Promise<RussianDailyNextActionReceipt> {
  // Every action is a separate POST. Reauthenticate, never trust the browser
  // to grant project-scoped authority or an issuer token.
  await requireChatGPTUser("/apps/russian-daily");

  const application = getApplicationConfig("russian-daily");
  if (!application || application.repository !== "BlueDragon33/Bauman-Russian-iOS") {
    throw new Error("Ứng dụng chưa khớp hồ sơ nguồn. Không tiếp tục.");
  }
  if (application.publicUrl || application.contractState === "connected") {
    throw new Error("Trạng thái ứng dụng đã thay đổi; cần đọc lại hồ sơ quản lý trước khi hành động.");
  }

  return {
    actionId: "RD-HOBBY-PREFLIGHT",
    kind: "PERSONAL_PROVIDER_READONLY_NAVIGATION",
    projectId: "project:bauman-russian-ios",
    sourceRevision: "ac15d64d1d9ba8f790de46d7889b4a24dd8dc9f6",
    status: "SAFE_NAVIGATION_ONLY",
    providerUrl: "https://vercel.com/account",
    reason: "Chưa có Vercel account/billing/quota readback hoặc runner được cấp quyền. Ưu tiên xác minh gói Hobby trước khi đăng ký hosting.",
    evidenceNeeded: "Chủ tài khoản xác nhận gói Hobby còn quota, quyền truy cập GitHub private repo, phương thức Preview không sinh Production và bảo vệ truy cập phù hợp.",
    blockedBy: "Thiếu xác minh Vercel, PROJECT_READ/issuer scoped runtime, independent QA/reviewer. Không chạy deploy, GitHub Actions, merge hay Production.",
    privilegedExecution: false,
    projectAuthority: "UNVERIFIED"
  };
}

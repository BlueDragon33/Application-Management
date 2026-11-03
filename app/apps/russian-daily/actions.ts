"use server";

import { requireChatGPTUser } from "../../chatgpt-auth";
import { getApplicationConfig } from "../../application-registry";

export type NextActionStep = {
  id: "session" | "catalog" | "policy" | "source" | "provider" | "preview" | "review" | "production";
  label: string;
  state: "VERIFIED_LOCAL" | "BLOCKED" | "NOT_RUN";
  evidence: string;
};

export type RussianDailyNextActionReceipt = {
  contractVersion: "russian-daily-one-click/v1";
  actionId: "RD-ONE-CLICK-READONLY-PREFLIGHT";
  projectId: "project:bauman-russian-ios";
  sourceRevision: "ad6d5d1b49502036f8f6399b8f707182a16168e4";
  state: "BLOCKED_EXTERNAL_GATE";
  workPackageExecution: false;
  automaticProgression: true;
  privilegedExecution: false;
  projectAuthority: "UNVERIFIED";
  steps: NextActionStep[];
  blocker: string;
  oneNextAction: string;
};

/**
 * One click executes every supported read-only control-plane preflight.
 * NEVER claims repository HEAD, provider quota, project authority, build,
 * review or deployment without independent verification. No redirect.
 * No timer, polling, recurring action or fake background execution.
 */
export async function runRussianDailyNextAction(): Promise<RussianDailyNextActionReceipt> {
  // Actual server-side authentication happens on each button invocation.
  await requireChatGPTUser("/apps/russian-daily");

  const steps: NextActionStep[] = [
    {
      id: "session", label: "Xác thực phiên quản trị",
      state: "VERIFIED_LOCAL",
      evidence: "requireChatGPTUser đã xác thực yêu cầu hiện tại; không suy ra PROJECT_READ hay quyền executor."
    }
  ];
  const app = getApplicationConfig("russian-daily");
  if (!app || app.repository !== "BlueDragon33/Bauman-Russian-iOS" ||
      app.href !== "/apps/russian-daily") {
    throw new Error("Danh mục dự án sai định danh. Dừng fail-closed.");
  }
  steps.push({
    id: "catalog", label: "Đối chiếu danh mục ứng dụng",
    state: "VERIFIED_LOCAL",
    evidence: "Đọc registry trong phiên bản Application-Management hiện hành; tên repository và route đúng. Đây không phải live GitHub HEAD."
  });
  if (app.status !== "planned" || app.contractState !== "pending" || app.publicUrl ||
      app.previewUrl || app.contractSource === "repository") {
    throw new Error("Danh mục không còn ở trạng thái candidate metadata-only. Cần kiểm tra trước khi tiếp tục.");
  }
  steps.push({
    id: "policy", label: "Kiểm tra cổng ZERO-SPEND và phát hành",
    state: "VERIFIED_LOCAL",
    evidence: "Registry chưa gán Preview/Production URL và không công bố kết nối quản trị; chưa có quyền tạo hosting hoặc dùng tài nguyên tính phí."
  });
  steps.push({
    id: "source", label: "Đối chiếu HEAD GitHub riêng",
    state: "BLOCKED",
    evidence: "Server không có GitHub readback đã cấp quyền cho private repository. SHA ở candidate chỉ là nguồn tham chiếu, không phải HEAD live xác minh."
  });
  for (const [id,label] of [
    ["provider","Xác minh Vercel Hobby, quota và bảo vệ Preview"],
    ["preview","Chạy build/Preview và kiểm thử thiết bị"],
    ["review","Nhận review độc lập và quyền WorkPackage"],
    ["production","Quyết định Production và xác minh URL"]
  ] as const) {
    steps.push({id, label, state:"NOT_RUN", evidence:"Chưa có bằng chứng đủ điều kiện; không được tự thực hiện hoặc tự PASS."});
  }
  return {
    contractVersion:"russian-daily-one-click/v1",
    actionId:"RD-ONE-CLICK-READONLY-PREFLIGHT",
    projectId:"project:bauman-russian-ios",
    sourceRevision:"ad6d5d1b49502036f8f6399b8f707182a16168e4",
    state:"BLOCKED_EXTERNAL_GATE",
    workPackageExecution:false,
    automaticProgression:true,
    privilegedExecution:false,
    projectAuthority:"UNVERIFIED",
    steps,
    blocker:"Thiếu readback GitHub private tại runtime, Vercel connector/grant và môi trường QA hợp lệ. Không tự cấp quyền hoặc mở deployment.",
    oneNextAction:"Kết nối Vercel Hobby và cấp quyền kiểm tra repository/project có phạm vi. Sau đó tiếp tục bằng bộ executor được cấp quyền; không cần lặp lại các bước đã có bằng chứng."
  };
}

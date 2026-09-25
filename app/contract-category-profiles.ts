import { standardDeviceExperiences, type ApplicationCategory, type ApplicationConfig } from "./application-registry";

export type ContractCategoryProfile = {
  category: ApplicationCategory;
  defaultCapabilities: readonly string[];
  defaultGuardrails: readonly string[];
  recommendedContractCapabilities: readonly string[];
  devicePolicy: string;
};

export const contractCategoryProfiles: Record<ApplicationCategory, ContractCategoryProfile> = {
  "Học tập": {
    category: "Học tập",
    defaultCapabilities: ["Thiết bị & truy cập", "Tiến độ / nội dung", "Quyền chỉnh sửa"],
    defaultGuardrails: ["Không kéo dữ liệu học tập chi tiết về control-plane", "Chỉ bật thao tác khi contract live xác nhận capability thật"],
    recommendedContractCapabilities: ["deviceRegistry", "deviceApproval", "deviceEditPermission", "contentReview", "audit", "webLaunch"],
    devicePolicy: "Registry thuộc client · desktop/tablet/phone · access/edit tách biệt.",
  },
  "Y tế": {
    category: "Y tế",
    defaultCapabilities: ["Thiết bị & truy cập", "Quyền chỉnh sửa", "Kiểm duyệt nội dung"],
    defaultGuardrails: ["Không đưa hồ sơ sức khỏe cá nhân về control-plane", "Không suy ra quyền từ client khác", "Mọi mutation phải có audit phía client"],
    recommendedContractCapabilities: ["deviceRegistry", "deviceApproval", "deviceBlock", "deviceEditPermission", "sessions", "contentReview", "audit", "webLaunch"],
    devicePolicy: "Registry thuộc client Y tế · không đồng bộ dữ liệu sức khỏe cá nhân · thiết bị được phân loại tại client.",
  },
  "Nga": {
    category: "Nga",
    defaultCapabilities: ["Thiết bị & truy cập", "Phiên & thu hồi", "Quyền chỉnh sửa", "Audit"],
    defaultGuardrails: ["Không dùng registry của ứng dụng khác", "Không có quyền ngầm giữa các client", "Không lưu nội dung cá nhân không cần thiết tại Trung tâm"],
    recommendedContractCapabilities: ["deviceRegistry", "deviceApproval", "deviceBlock", "sessions", "audit", "webLaunch"],
    devicePolicy: "Registry riêng theo client · session/revoke thuộc client · control-plane chỉ giữ metadata quản trị cần thiết.",
  },
  "Học thuật": {
    category: "Học thuật",
    defaultCapabilities: ["Thiết bị", "Lộ trình / nội dung", "Session", "Audit"],
    defaultGuardrails: ["Sub-client không tự trở thành client cấp 1", "Runtime và dữ liệu học thuật thuộc client", "Chỉ dùng endpoint contract chuẩn"],
    recommendedContractCapabilities: ["deviceRegistry", "deviceApproval", "deviceBlock", "sessions", "audit", "contentReview", "webLaunch"],
    devicePolicy: "Registry học thuật riêng · Device Gate do client sở hữu · desktop/tablet/phone.",
  },
  "Gia đình": {
    category: "Gia đình",
    defaultCapabilities: ["Thiết bị & truy cập", "Quyền sửa", "Trạng thái runtime", "Audit metadata"],
    defaultGuardrails: ["Không đưa dữ liệu trẻ em/gia đình riêng tư về control-plane", "Không đưa dữ liệu sức khỏe/dinh dưỡng riêng tư", "Chỉ lưu metadata vận hành tối thiểu"],
    recommendedContractCapabilities: ["deviceRegistry", "deviceApproval", "deviceBlock", "deviceEditPermission", "audit", "webLaunch"],
    devicePolicy: "Privacy-first · registry thuộc client · access/edit tách biệt.",
  },
  "Kế toán": {
    category: "Kế toán",
    defaultCapabilities: ["Thiết bị", "Báo cáo", "Nhập/xuất dữ liệu", "Backup", "Audit"],
    defaultGuardrails: ["Không đưa dữ liệu khách hàng/báo giá vào control-plane", "Mutation chỉ bật khi contract xác nhận optimistic concurrency", "Không dùng chung registry"],
    recommendedContractCapabilities: ["deviceRegistry", "deviceApproval", "deviceBlock", "audit", "reports", "webLaunch"],
    devicePolicy: "Registry kế toán riêng · local-first khi phù hợp · dữ liệu nghiệp vụ ở client.",
  },
  "Kỹ thuật": {
    category: "Kỹ thuật",
    defaultCapabilities: ["Thiết bị", "Runtime", "Feature flags", "Policy", "Audit"],
    defaultGuardrails: ["Không lưu credential thiết bị kỹ thuật tại control-plane", "Không proxy lệnh nguy hiểm nếu contract chưa xác minh", "Không giả trạng thái connected"],
    recommendedContractCapabilities: ["deviceRegistry", "audit", "webLaunch"],
    devicePolicy: "Registry kỹ thuật riêng · desktop/tablet/phone · remote control fail-closed.",
  },
};

export type DynamicManagedApplication = Omit<ApplicationConfig, "id" | "tier" | "deviceExperiences"> & {
  id: string;
  tier: "client";
  deviceExperiences: typeof standardDeviceExperiences;
};

export function dynamicApplicationConfig(input: {
  id: string;
  name: string;
  shortName: string;
  category: ApplicationCategory;
  origin: string;
  publicUrl?: string | null;
  repository?: string | null;
  contractState: "connected" | "migrating" | "pending";
  contractNote: string;
  capabilities?: readonly string[];
}): DynamicManagedApplication {
  const profile = contractCategoryProfiles[input.category];
  return {
    id: input.id,
    name: input.name,
    shortName: input.shortName,
    href: `/tools/contract-diagnostics?app=${encodeURIComponent(input.id)}`,
    publicUrl: input.publicUrl || input.origin,
    initials: input.shortName.replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "APP",
    category: input.category,
    tier: "client",
    status: input.contractState === "connected" ? "online" : "warning",
    contractState: input.contractState,
    repository: input.repository || "Dynamic catalog",
    scope: `Client động thuộc nhóm ${input.category}; Application Management quản trị qua Universal Management Contract.`,
    contractNote: input.contractNote,
    devicePolicy: profile.devicePolicy,
    deviceExperiences: standardDeviceExperiences,
    capabilities: input.capabilities?.length ? input.capabilities : profile.defaultCapabilities,
    guardrails: profile.defaultGuardrails,
  };
}

export const universalContractCapabilityKeys = [
  "deviceRegistry",
  "deviceApproval",
  "deviceBlock",
  "deviceUnblock",
  "deviceEditPermission",
  "deviceIdempotentCommands",
  "optimisticConcurrency",
  "sessions",
  "audit",
  "contentReview",
  "payments",
  "reports",
  "webLaunch",
] as const;

export function contractStarterForCategory(input: {
  id: string;
  name: string;
  category: ApplicationCategory;
}) {
  const profile = contractCategoryProfiles[input.category];
  return {
    schema: "application-management.contract/v1",
    application: {
      id: input.id,
      name: input.name,
      category: input.category,
      version: "1.0.0",
    },
    capabilities: Object.fromEntries(universalContractCapabilityKeys.map((key) => [key, false])),
    endpoints: {
      status: "/api/control/status",
      devices: "/api/control/devices",
      deviceCommands: "/api/control/device-commands",
    },
    onboarding: {
      recommendedCapabilities: profile.recommendedContractCapabilities,
      guardrails: profile.defaultGuardrails,
      note: "Chỉ đổi capability sang true sau khi endpoint thật đã triển khai và kiểm thử.",
    },
  };
}

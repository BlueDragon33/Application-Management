export type ApplicationStatus = "online" | "warning" | "planned";
export type AdminContractState = "connected" | "migrating" | "pending";
export type DeviceClass = "desktop" | "tablet" | "phone";
export type SubClientState = "independent" | "module" | "planned";

export type DeviceExperience = {
  id: DeviceClass;
  label: string;
  viewport: string;
  shell: string;
  navigation: string;
  density: string;
  interaction: string;
};

export type SubClientConfig = {
  id: string;
  name: string;
  initials: string;
  kind: "subject-site" | "module";
  repository?: string;
  sourcePath?: string;
  state: SubClientState;
  contractState: AdminContractState;
  note: string;
};

export type ApplicationConfig = {
  id: "boi-ech" | "health-care" | "ru-life" | "bauman-master-ai" | "growup-mychildren";
  name: string;
  shortName: string;
  href: string;
  initials: string;
  tier: "client";
  status: ApplicationStatus;
  contractState: AdminContractState;
  repository: string;
  scope: string;
  contractNote: string;
  devicePolicy: string;
  deviceExperiences: readonly DeviceExperience[];
  childClients?: readonly SubClientConfig[];
  capabilities: readonly string[];
  guardrails: readonly string[];
};

export const standardDeviceExperiences: readonly DeviceExperience[] = [
  { id: "desktop", label: "Máy tính", viewport: "≥ 1024 px", shell: "Dashboard rộng, 2–4 cột theo nghiệp vụ", navigation: "Sidebar cố định hoặc thu gọn", density: "Mật độ thông tin cao", interaction: "Chuột + bàn phím, hỗ trợ phím tắt" },
  { id: "tablet", label: "Tablet / iPad", viewport: "600–1023 px", shell: "1–2 cột linh hoạt, vùng nội dung ưu tiên", navigation: "Rail thu gọn hoặc tab theo ngữ cảnh", density: "Mật độ trung bình", interaction: "Touch-first, vùng chạm tối thiểu 44 px" },
  { id: "phone", label: "Điện thoại", viewport: "< 600 px", shell: "Một cột, nội dung theo thứ tự ưu tiên", navigation: "Điều hướng gọn/bottom navigation khi phù hợp", density: "Mật độ thấp, ưu tiên tác vụ chính", interaction: "Touch-first, không phụ thuộc hover" },
];

const baumanChildren: readonly SubClientConfig[] = [
  { id: "math", name: "Toán Bauman", initials: "MATH", kind: "subject-site", repository: "BlueDragon33/Math_Bauman", state: "independent", contractState: "pending", note: "Đã có repo độc lập. Bauman Hub là client cha; contract quản trị sub-client vẫn phải được công bố trước khi Trung tâm điều khiển." },
  { id: "programming", name: "Lập trình", initials: "DEV", kind: "module", sourcePath: "subjects/programming", state: "module", contractState: "pending", note: "Hiện nằm trong cây subjects của Bauman; có thể tách thành site môn học độc lập khi ổn định runtime và contract." },
  { id: "ai", name: "AI", initials: "AI", kind: "module", sourcePath: "subjects/ai", state: "module", contractState: "pending", note: "Client con logic trong Bauman; chưa được coi là site độc lập cho tới khi có runtime/repo/contract riêng." },
  { id: "signal", name: "Tín hiệu", initials: "SIG", kind: "module", sourcePath: "subjects/signal", state: "module", contractState: "pending", note: "Đang là module môn học của Bauman và được biểu diễn như sub-client logic, không phải client cấp 1 của Trung tâm." },
  { id: "systems", name: "Hệ thống", initials: "SYS", kind: "module", sourcePath: "subjects/systems", state: "module", contractState: "pending", note: "Thuộc Bauman Hub; mọi quản trị đi qua contract của client cha cho tới khi được tách độc lập." },
  { id: "foundation", name: "Nền tảng", initials: "FND", kind: "module", sourcePath: "subjects/foundation", state: "module", contractState: "pending", note: "Thuộc cây môn học Bauman; Trung tâm chỉ nhìn cấu trúc, không sở hữu runtime hoặc dữ liệu môn học." },
  { id: "research", name: "Nghiên cứu", initials: "R&D", kind: "module", sourcePath: "subjects/research", state: "module", contractState: "pending", note: "Sub-client logic của Bauman; tách repo/site sau khi kiến trúc môn học ổn định." },
  { id: "russian", name: "Tiếng Nga", initials: "RU", kind: "module", sourcePath: "subjects/russian", state: "module", contractState: "pending", note: "Nằm trong Bauman Hub, không đồng nhất với client Hòa nhập Nga ở cấp 1." },
];

export const applicationRegistry: readonly ApplicationConfig[] = [
  {
    id: "boi-ech", name: "Bơi ếch AI", shortName: "Bơi ếch", href: "/apps/boi-ech", initials: "BE", tier: "client", status: "online", contractState: "connected", repository: "BlueDragon33/BOIECH_AI",
    scope: "Client học Bơi ếch độc lập; Trung tâm quản trị qua bridge ký số và không chạy nội dung học tập.",
    contractNote: "Admin bridge đang hoạt động. Khu quản trị Bơi ếch đã tách vật lý khỏi control-plane và chỉ còn nghiệp vụ của chính client.",
    devicePolicy: "Registry BE riêng · tự nhận diện desktop/phone/tablet-iPad · quyền truy cập và quyền sửa tách biệt.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["Thiết bị & truy cập", "Tiến độ học", "AI", "Thanh toán & thời hạn", "Duyệt nội dung"],
    guardrails: ["Không quản trị dữ liệu của ứng dụng khác", "Không cấp quyền quản trị Trung tâm", "Không dùng chung registry thiết bị với site khác"],
  },
  {
    id: "health-care", name: "Sức khỏe Y tế", shortName: "Sức khỏe Y tế", href: "/apps/health-care", initials: "YT", tier: "client", status: "warning", contractState: "migrating", repository: "BlueDragon33/Health_Care",
    scope: "Client sức khỏe độc lập; runtime, Device Gate, dữ liệu và Control API nằm trong Health_Care.",
    contractNote: "Adapter quản trị thật đã được nối và CI đã xanh: thiết bị, policy, session, duyệt nội dung và audit đều gọi Control API riêng của Health_Care. Chưa chuyển sang connected cho tới khi xác minh secret/origin/deployment production.",
    devicePolicy: "Registry Health_Care riêng · tự phân loại máy tính, điện thoại, tablet/iPad · không lưu hồ sơ sức khỏe cá nhân tại Trung tâm.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["Thiết bị đầu vào", "Cấp/khóa truy cập", "Quyền chỉnh sửa", "Theo dõi vận hành", "Kiểm duyệt nội dung"],
    guardrails: ["Không chứa hồ sơ sức khỏe cá nhân", "Không dùng API/DB Bơi ếch", "Không gộp runtime với Trung tâm"],
  },
  {
    id: "ru-life", name: "Hòa nhập Nga", shortName: "Hòa nhập Nga", href: "/apps/ru-life", initials: "RU", tier: "client", status: "warning", contractState: "migrating", repository: "BlueDragon33/RU_LIFE",
    scope: "Client Hòa nhập Nga độc lập; RU_LIFE sở hữu D1, registry HN, challenge P-256, session ledger và audit; không có đăng nhập trực tiếp.",
    contractNote: "RU_LIFE main đã chuyển sang D1/registry/session riêng và CI standalone đã xanh. Application Management chỉ phát vé bridge 5 phút rồi gọi Control API của RU_LIFE; vẫn giữ migrating cho tới khi cấu hình RU_LIFE_BASE_URL, secret chung và D1 production được xác minh.",
    devicePolicy: "Registry HN thuộc RU_LIFE · server RU_LIFE tự phân loại computer/phone/tablet-iPad · Application Management chỉ gắn người dùng/cấp policy qua signed Control API · access/edit tách biệt.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["Thiết bị HN", "Cấp/khóa truy cập", "Phân loại thiết bị", "Quyền chỉnh sửa", "Phiên & thu hồi từ xa", "Audit HN"],
    guardrails: ["Không lưu registry/session HN trong DB Trung tâm", "Không dùng QT/BE/SK làm namespace HN", "Không có đăng nhập trực tiếp trên RU_LIFE", "Không dùng secret Health/Bơi ếch"],
  },
  {
    id: "bauman-master-ai", name: "Bauman Master AI", shortName: "Bauman Hub", href: "/apps/bauman-master-ai", initials: "BM", tier: "client", status: "warning", contractState: "pending", repository: "BlueDragon33/Bauman-master-ai-system",
    scope: "Client lớn cấp 1 đóng vai trò Bauman Hub; bên trong có thể quản trị các client/site môn học cấp 2.",
    contractNote: "Bauman main đã có machine-readable management contract và khu quản trị Hub riêng; admin API/device/audit backend vẫn chưa tồn tại nên chưa bật thao tác vận hành.",
    devicePolicy: "Bauman phải sở hữu registry BM- riêng; sub-client kế thừa policy hoặc sở hữu registry riêng khi tách site, không dùng registry của Trung tâm.",
    deviceExperiences: standardDeviceExperiences, childClients: baumanChildren,
    capabilities: ["Lộ trình & môn học", "Sub-client môn học", "Thiết bị truy cập", "Quyền chỉnh sửa", "Contract dữ liệu riêng", "Theo dõi trạng thái"],
    guardrails: ["Không mở thẳng site học từ Trung tâm", "Không dùng hàng đợi Bơi ếch", "Sub-client thuộc Bauman không tự trở thành client cấp 1", "Chỉ bật chức năng có backend thật"],
  },
  {
    id: "growup-mychildren", name: "GrowUP MyChildren", shortName: "GrowUP", href: "/apps/growup-mychildren", initials: "GU", tier: "client", status: "warning", contractState: "pending", repository: "BlueDragon33/GrowUP_MyChildren",
    scope: "Client phát triển và học tập 3–18 tuổi đã có runtime/PWA độc lập; quản trị từ xa phải giữ nguyên mô hình local-first và privacy-first.",
    contractNote: "GrowUP main đã có runtime, PWA, privacy-safe local audit và machine-readable management contract. Device registry GU-, admin API và remote audit/config review API vẫn chưa tồn tại nên chưa bật thao tác quản trị từ xa.",
    devicePolicy: "Khi triển khai phải dùng registry GU- riêng · desktop/tablet/phone · access/edit tách biệt · không đưa child/health data vào control-plane.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["Thiết bị truy cập", "Quyền sửa", "Trạng thái runtime", "Kiểm duyệt cấu hình", "Audit metadata an toàn"],
    guardrails: ["Không chuyển hồ sơ trẻ em về Trung tâm", "Không chuyển health/nutrition/private notes", "Không dùng DB ứng dụng khác", "Không bật quản trị khi chưa có backend thật"],
  },
];

export function getApplicationConfig(id: string) {
  return applicationRegistry.find((application) => application.id === id);
}

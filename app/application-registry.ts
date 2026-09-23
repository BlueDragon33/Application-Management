export type ApplicationStatus = "online" | "warning" | "planned";
export type ApplicationCategory = "Học tập" | "Y tế" | "Nga" | "Học thuật" | "Gia đình" | "Kế toán";
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
  id: "boi-ech" | "health-care" | "ru-life" | "bauman-master-ai" | "growup-mychildren" | "price-report-tunggiabao";
  name: string;
  shortName: string;
  href: string;
  publicUrl?: string;
  initials: string;
  category: ApplicationCategory;
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
    id: "boi-ech", name: "Bơi ếch AI", shortName: "Bơi ếch", href: "/apps/boi-ech", initials: "BE", category: "Học tập", tier: "client", status: "online", contractState: "connected", repository: "BlueDragon33/BOIECH_AI",
    scope: "Client học Bơi ếch độc lập; Trung tâm quản trị qua bridge ký số và không chạy nội dung học tập.",
    contractNote: "Admin bridge đang hoạt động. Khu quản trị Bơi ếch đã tách vật lý khỏi control-plane và chỉ còn nghiệp vụ của chính client.",
    devicePolicy: "Registry BE riêng · tự nhận diện desktop/phone/tablet-iPad · quyền truy cập và quyền sửa tách biệt.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["Thiết bị & truy cập", "Tiến độ học", "AI", "Thanh toán & thời hạn", "Duyệt nội dung"],
    guardrails: ["Không quản trị dữ liệu của ứng dụng khác", "Không cấp quyền quản trị Trung tâm", "Không dùng chung registry thiết bị với site khác"],
  },
  {
    id: "health-care", name: "Sức khỏe Y tế", shortName: "Sức khỏe Y tế", href: "/apps/health-care", initials: "YT", category: "Y tế", tier: "client", status: "warning", contractState: "migrating", repository: "BlueDragon33/Health_Care",
    scope: "Client sức khỏe độc lập; runtime, Device Gate, dữ liệu và Control API nằm trong Health_Care.",
    contractNote: "Adapter quản trị thật đã được nối và CI đã xanh: thiết bị, policy, session, duyệt nội dung và audit đều gọi Control API riêng của Health_Care. Chưa chuyển sang connected cho tới khi xác minh secret/origin/deployment production.",
    devicePolicy: "Registry Health_Care riêng · tự phân loại máy tính, điện thoại, tablet/iPad · không lưu hồ sơ sức khỏe cá nhân tại Trung tâm.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["Thiết bị đầu vào", "Cấp/khóa truy cập", "Quyền chỉnh sửa", "Theo dõi vận hành", "Kiểm duyệt nội dung"],
    guardrails: ["Không chứa hồ sơ sức khỏe cá nhân", "Không dùng API/DB Bơi ếch", "Không gộp runtime với Trung tâm"],
  },
  {
    id: "ru-life", name: "Hòa nhập Nga", shortName: "Hòa nhập Nga", href: "/apps/ru-life", publicUrl: "https://hoa-nhap-nga.dinhnam3391.chatgpt.site", initials: "RU", category: "Nga", tier: "client", status: "warning", contractState: "migrating", repository: "BlueDragon33/RU_LIFE",
    scope: "Client Hòa nhập Nga độc lập; RU_LIFE sở hữu D1, registry HN, challenge P-256, session ledger và audit; không có đăng nhập trực tiếp.",
    contractNote: "Application Management phát vé quản trị opaque 5 phút; RU_LIFE introspect ngược vé với Trung tâm rồi tự xử lý Control API trên D1/registry/session của chính RU_LIFE. Giữ migrating cho tới khi hai Site production được publish và handshake live được xác minh.",
    devicePolicy: "Registry HN thuộc RU_LIFE · server RU_LIFE tự phân loại computer/phone/tablet-iPad · Application Management chỉ gắn người dùng/cấp policy qua Control API · access/edit tách biệt.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["Thiết bị HN", "Cấp/khóa truy cập", "Phân loại thiết bị", "Quyền chỉnh sửa", "Phiên & thu hồi từ xa", "Audit HN", "Mở site độc lập để kiểm tra"],
    guardrails: ["Không lưu registry/session HN trong DB Trung tâm", "Không dùng QT/BE/SK làm namespace HN", "Không có đăng nhập trực tiếp trên RU_LIFE", "Thiết bị QT không tự kế thừa quyền HN"],
  },
  {
    id: "bauman-master-ai", name: "Bauman Master AI", shortName: "Bauman Hub", href: "/apps/bauman-master-ai", initials: "BM", category: "Học thuật", tier: "client", status: "warning", contractState: "migrating", repository: "BlueDragon33/Bauman-master-ai-system",
    scope: "Client lớn cấp 1 đóng vai trò Bauman Hub; Bauman sở hữu runtime học, Device Gate, registry BM-, session, audit và Control Service riêng; các site/môn cấp 2 vẫn nằm dưới Hub.",
    contractNote: "Bauman Control v4, registry BM-, P-256 Device Gate, session/revoke, audit và idempotent device commands đã được triển khai và đã qua local E2E. Khu quản trị thiết bị thật đã nối vào Application Management; giữ trạng thái migrating cho tới khi origin runtime + Control Service production được deploy và handshake live được xác minh.",
    devicePolicy: "Registry BM- thuộc Bauman · Device Gate P-256 bắt buộc trên runtime · quyền truy cập, session và audit không được lưu trong DB Trung tâm.",
    deviceExperiences: standardDeviceExperiences, childClients: baumanChildren,
    capabilities: ["Lộ trình & môn học", "Sub-client môn học", "Thiết bị BM-", "Duyệt/khóa truy cập", "P-256 Device Gate", "Session & thu hồi", "Audit Bauman", "Theo dõi trạng thái"],
    guardrails: ["Nút Website phải mở runtime học Bauman, không mở Control Service", "Không dùng hàng đợi Bơi ếch", "Sub-client thuộc Bauman không tự trở thành client cấp 1", "Không đánh dấu production connected chỉ vì CI xanh"],
  },
  {
    id: "price-report-tunggiabao", name: "PriceReport Tùng Gia Bảo", shortName: "Báo giá Tùng Gia Bảo",
    href: "/apps/price-report-tunggiabao", publicUrl: "https://bluedragon33.github.io/PriceReport_Tunggiabao/",
    initials: "KT", category: "Kế toán", tier: "client", status: "warning", contractState: "migrating",
    repository: "BlueDragon33/PriceReport_Tunggiabao",
    scope: "Client kế toán/báo giá local-first. Dữ liệu báo giá, khách hàng, danh mục và backup nằm tại client; Application Management chỉ đọc contract quản trị và metadata thiết bị được công bố an toàn.",
    contractNote: "Management contract V1 và KT Control đã có registry/device-control thật trong local stack, gồm P-256 session, optimistic concurrency, idempotent command và read-back. Production vẫn giữ trạng thái migrating cho tới khi origin/secret/deployment live được xác minh.",
    devicePolicy: "Namespace KT- · client tự phân loại máy tính/tablet-iPad/điện thoại · UI đối ứng theo device class · không dùng LocalStorage client để giả lập quyền quản trị từ xa.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["Báo giá & bảng giá", "Excel / PDF / OCR", "Phân loại thiết bị KT-", "UI theo loại thiết bị", "Backup local/PC", "Management contract"],
    guardrails: ["Không đưa dữ liệu báo giá/khách hàng vào control-plane", "Duyệt/khóa chỉ bật khi KT Control live xác nhận đủ capability và read-back", "Không dùng chung registry BM/BE/HN", "Truy cập Web không đồng nghĩa production remote-admin sẵn sàng"],
  },
  {
    id: "growup-mychildren", name: "GrowUP MyChildren", shortName: "GrowUP", href: "/apps/growup-mychildren", initials: "GU", category: "Gia đình", tier: "client", status: "warning", contractState: "pending", repository: "BlueDragon33/GrowUP_MyChildren",
    scope: "Client phát triển và học tập 3–18 tuổi đã có runtime/PWA độc lập; quản trị từ xa phải giữ nguyên mô hình local-first và privacy-first.",
    contractNote: "GrowUP đã có runtime/PWA, management contract và local Control Service privacy-safe cho registry GU-, approve/block, optimistic concurrency, idempotent command và audit metadata. Production remote vẫn chưa được coi là sẵn sàng cho tới khi client công bố/deploy đầy đủ capability tương ứng.",
    devicePolicy: "Khi triển khai phải dùng registry GU- riêng · desktop/tablet/phone · access/edit tách biệt · không đưa child/health data vào control-plane.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["Thiết bị truy cập", "Quyền sửa", "Trạng thái runtime", "Kiểm duyệt cấu hình", "Audit metadata an toàn"],
    guardrails: ["Không chuyển hồ sơ trẻ em về Trung tâm", "Không chuyển health/nutrition/private notes", "Không dùng DB ứng dụng khác", "Chỉ bật thao tác khi Control Service thật xác nhận capability; local readiness không tự suy ra production readiness"],
  },
];

export function getApplicationConfig(id: string) {
  return applicationRegistry.find((application) => application.id === id);
}

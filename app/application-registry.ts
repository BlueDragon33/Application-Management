export type ApplicationStatus = "online" | "warning" | "planned";
export type ApplicationCategory = "Học tập" | "Y tế" | "Nga" | "Học thuật" | "Gia đình" | "Kế toán" | "Kỹ thuật";
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
  id: string;
  name: string;
  shortName: string;
  href: string;
  publicUrl?: string;
  localUrl?: string;
  initials: string;
  iconPath?: string;
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
    id: "software-blueprint-hub", name: "Software Blueprint Hub", shortName: "Blueprint OS", href: "/apps/software-blueprint-hub",
    initials: "BP", category: "Kỹ thuật", tier: "client", status: "warning", contractState: "migrating",
    repository: "BlueDragon33/Software-Blueprint-Hub",
    scope: "Core Engineering Compass / “kim chỉ nam” của toàn hệ sinh thái. Blueprint OS tổ chức hệ thống theo kiến trúc 20 tầng: Constitution → Contract/Schema → Persistence → Blueprint Engine → Project Lifecycle → Planning → Quality → Prompt → UX → Knowledge → App-Manage Contract → Compass → Self-audit → Bootstrap Factory → Pattern Governance → Resilience → Secure Integrations → Bounded AI → Ecosystem Dogfooding → Acceptance Gate. Application Management chỉ quan sát lifecycle/readiness metadata; canonical engineering state vẫn thuộc Blueprint OS.",
    contractNote: "Blueprint OS đã PASS Phase 8 và đang ở Phase 9 Compass Construction / Storey 20. P9-001–P9-018 COMPLETE; P9-019 Human Professional Review đang ACTIVE với exact review candidate và human-signoff-required là blocker duy nhất của phase gate. P9-020 chưa được phép bắt đầu. Contract application-management.contract/v1 vẫn metadata-only: không Remote Admin, không Device Gate, không Quality Gate authority và không Production release authority.",
    devicePolicy: "Không có device registry riêng cho metadata integration. UI Blueprint OS vẫn phải responsive desktop/tablet/phone; mọi identity/authority canonical do Blueprint OS sở hữu, không kế thừa quyền từ Application Management.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["20 tầng Compass Construction", "Constitution & authority", "Contract/schema foundation", "Canonical persistence", "Blueprint resolver & Project Profile", "Roadmap · Work Package · dependency", "Quality Gate & evidence", "Prompt Projection", "Knowledge & Reference Case", "Source-of-truth self-audit", "Project bootstrap factory", "Pattern promotion governance", "Canonical backup integrity", "Restore preview safety", "Incident diagnostics", "Provider/plugin boundary", "Bounded AI proposals", "Portfolio & evidence graph", "Security & lifecycle", "Adaptive UX & capacity proof", "Ecosystem dogfood", "Human professional review", "Release & Lessons"],
    guardrails: ["Control-plane chỉ đọc lifecycle/readiness metadata", "Không mutate canonical Blueprint/Constitution", "Không PASS Quality Gate thay Blueprint OS", "Không authorize Production release", "Không bịa remote-admin/device operations khi contract metadata-only"],
  },
  {
    id: "boi-ech", name: "Bơi ếch AI", shortName: "Bơi ếch", href: "/apps/boi-ech", publicUrl: "https://boi-ech.boiech-ai.workers.dev/", initials: "BE", iconPath: "/app-icons/boi-ech.svg", category: "Học tập", tier: "client", status: "online", contractState: "connected", repository: "BlueDragon33/BOIECH_AI",
    scope: "Web-app Bơi ếch độc lập, local-first; mở trực tiếp khi phát triển. Bridge/quyền online chỉ dùng khi cần thao tác quản trị từ xa.",
    contractNote: "Admin bridge đang hoạt động. Khu quản trị Bơi ếch đã tách vật lý khỏi control-plane và chỉ còn nghiệp vụ của chính client.",
    devicePolicy: "Registry BE riêng · tự nhận diện desktop/phone/tablet-iPad · quyền truy cập và quyền sửa tách biệt.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["Thiết bị & truy cập", "Tiến độ học", "AI", "Thanh toán & thời hạn", "Duyệt nội dung"],
    guardrails: ["Không quản trị dữ liệu của ứng dụng khác", "Không cấp quyền quản trị Trung tâm", "Không dùng chung registry thiết bị với site khác"],
  },
  {
    id: "health-care", name: "Sức khỏe Y tế", shortName: "Sức khỏe Y tế", href: "/apps/health-care", initials: "YT", iconPath: "/app-icons/health-care.svg", category: "Y tế", tier: "client", status: "warning", contractState: "migrating", repository: "BlueDragon33/Health_Care",
    scope: "Web-app Sức khỏe độc lập, local-first. Giao diện phải mở không phụ thuộc App Manager; Device Gate/Control API chỉ phục vụ quyền và đồng bộ online khi được bật.",
    contractNote: "Adapter quản trị thật đã được nối và CI đã xanh: thiết bị, policy, session, duyệt nội dung và audit đều gọi Control API riêng của Health_Care. Chưa chuyển sang connected cho tới khi xác minh secret/origin/deployment production.",
    devicePolicy: "Registry Health_Care riêng · tự phân loại máy tính, điện thoại, tablet/iPad · không lưu hồ sơ sức khỏe cá nhân tại Trung tâm.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["Thiết bị đầu vào", "Cấp/khóa truy cập", "Quyền chỉnh sửa", "Theo dõi vận hành", "Kiểm duyệt nội dung"],
    guardrails: ["Không chứa hồ sơ sức khỏe cá nhân", "Không dùng API/DB Bơi ếch", "Không gộp runtime với Trung tâm"],
  },
  {
    id: "ru-life", name: "Hòa nhập Nga", shortName: "Hòa nhập Nga", href: "/apps/ru-life", publicUrl: "https://hoa-nhap-nga.dinhnam3391.chatgpt.site", initials: "RU", iconPath: "/app-icons/ru-life.svg", category: "Nga", tier: "client", status: "warning", contractState: "migrating", repository: "BlueDragon33/RU_LIFE",
    scope: "Web-app Hòa nhập Nga độc lập, local-first. Standalone Development không phụ thuộc App Manager; D1/registry HN/challenge/session chỉ là lớp online tùy chọn và được bật lại khi release.",
    contractNote: "Application Management phát vé quản trị opaque 5 phút; RU_LIFE introspect ngược vé với Trung tâm rồi tự xử lý Control API trên D1/registry/session của chính RU_LIFE. Giữ migrating cho tới khi hai Site production được publish và handshake live được xác minh.",
    devicePolicy: "Registry HN thuộc RU_LIFE · server RU_LIFE tự phân loại computer/phone/tablet-iPad · Application Management chỉ gắn người dùng/cấp policy qua Control API · access/edit tách biệt.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["Thiết bị HN", "Cấp/khóa truy cập", "Phân loại thiết bị", "Quyền chỉnh sửa", "Phiên & thu hồi từ xa", "Audit HN", "Mở site độc lập để kiểm tra"],
    guardrails: ["Không lưu registry/session HN trong DB Trung tâm", "Không dùng QT/BE/SK làm namespace HN", "Không có đăng nhập trực tiếp trên RU_LIFE", "Thiết bị QT không tự kế thừa quyền HN"],
  },
  {
    id: "bauman-master-ai", name: "Bauman Master AI", shortName: "Bauman Hub", href: "/apps/bauman-master-ai", publicUrl: "https://bauman-master-ai.boiech-ai.workers.dev/", initials: "BM", iconPath: "/app-icons/bauman-master-ai.svg", category: "Học thuật", tier: "client", status: "warning", contractState: "migrating", repository: "BlueDragon33/Bauman-master-ai-system",
    scope: "Web-app Bauman độc lập, local-first. Trong Standalone Development Mode mở thẳng runtime học; Device Gate/registry BM-/Control Service chỉ bật khi cần quyền online hoặc khi chuyển Release Mode.",
    contractNote: "Bauman Control, registry BM-, P-256 Device Gate, session/revoke, audit và idempotent device commands đã được triển khai và đã qua local E2E. Khu quản trị thiết bị thật đã nối vào Application Management; giữ trạng thái migrating cho tới khi origin runtime + Control Service production được deploy và handshake live được xác minh.",
    devicePolicy: "Standalone Development: không bắt duyệt thiết bị để mở app. Managed/Release Mode mới bật lại registry BM-, P-256, session và audit.",
    deviceExperiences: standardDeviceExperiences, childClients: baumanChildren,
    capabilities: ["Lộ trình & môn học", "Sub-client môn học", "Thiết bị BM-", "Duyệt/khóa truy cập", "P-256 Device Gate", "Session & thu hồi", "Audit Bauman", "Theo dõi trạng thái"],
    guardrails: ["Nút Website phải mở runtime học Bauman, không mở Control Service", "Không dùng hàng đợi Bơi ếch", "Sub-client thuộc Bauman không tự trở thành client cấp 1", "Không đánh dấu production connected chỉ vì CI xanh"],
  },
  {
    id: "price-report-tunggiabao", name: "PriceReport Tùng Gia Bảo", shortName: "Báo giá Tùng Gia Bảo",
    href: "/apps/price-report-tunggiabao", publicUrl: "https://bluedragon33.github.io/PriceReport_Tunggiabao/",
    initials: "KT", iconPath: "/app-icons/price-report-tunggiabao.svg", category: "Kế toán", tier: "client", status: "warning", contractState: "migrating",
    repository: "BlueDragon33/PriceReport_Tunggiabao",
    scope: "Web-app báo giá/kế toán độc lập, local-first. V6.14 mặc định Standalone Mode: mở trực tiếp, không cần Application Management duyệt thiết bị; dữ liệu báo giá, khách hàng, danh mục và backup vẫn thuộc client.",
    contractNote: "KT Control đã có registry/device-control thật trong local stack. V6.14 đã live trên GitHub Pages với Device Gate DISABLED / STANDALONE MODE. Production vẫn giữ trạng thái migrating; Managed Mode chỉ bật khi control origin + health read-back hợp lệ.",
    devicePolicy: "Namespace KT- · client tự phân loại máy tính/tablet-iPad/điện thoại · Standalone không yêu cầu duyệt thiết bị · Managed/Release Mode mới bật registry P-256, session/revoke và remote-admin.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["Báo giá & bảng giá", "Excel / PDF / OCR", "Standalone/Managed access mode", "Phân loại thiết bị KT-", "UI theo loại thiết bị", "Backup local/PC", "Management contract"],
    guardrails: ["Không đưa dữ liệu báo giá/khách hàng vào control-plane", "Mất App Manager không được chặn core runtime local-first", "Duyệt/khóa chỉ bật khi KT Control live xác nhận đủ capability và read-back", "Không dùng chung registry BM/BE/HN"],
  },
  {
    id: "nc03-modem", name: "NC03 Control Center", shortName: "NC03 Modem", href: "/apps/nc03-modem",
    localUrl: "/api/local-web-launch?app=nc03-modem",
    initials: "N3", iconPath: "/app-icons/nc03-modem.svg", category: "Kỹ thuật", tier: "client", status: "warning", contractState: "pending",
    repository: "BlueDragon33/NC03_Modem",
    scope: "Website-app/PWA local-first quản trị modem HYBRID Wi-Fi 5G NC03. Application Management quản lý lifecycle, release và điểm mở ứng dụng; credential/session modem luôn ở thiết bị người dùng.",
    contractNote: "NC03 Control Center dùng runtime local độc lập và được mở qua network resolver của Application Management. HAR Evidence Lab, AUTH Source Probe và telemetry đều chạy trên chính NC03 Local Bridge; launcher phải xác nhận đúng application identity + version trước khi cho mở. AUTH/write tiếp tục fail-closed cho tới khi VERIFIED.",
    devicePolicy: "Desktop/tablet/phone responsive · local-first · không đồng bộ mật khẩu/token/session modem lên control-plane · App Management chỉ mở runtime local, không proxy lệnh modem.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["Mở NC03 Control Center", "HAR Evidence Lab local-only", "AUTH/WRITE candidate separation", "Sanitized evidence export", "Live telemetry 10 giây không rerender trang", "Last-known-good + timestamp", "Pin % chính xác luôn hiển thị", "Kết nối + sóng + 4G/5G", "Advanced snapshot freshness + retry", "Báo cáo chẩn đoán A4 · In/Lưu PDF", "Report data-quality: 0 ≠ thiếu dữ liệu", "Live/Advanced freshness", "Privacy-safe report allow-list", "Mobile Data / SIM PIN / Cloud SIM read-only", "Firmware 8.00.42 HAR2 read profile", "4 Wi-Fi AP", "USB/Bridge/Security/NTP/Power/FOTA read-only", "Count-only DHCP/Port/Packet-filter inventory", "Thiết bị kết nối", "RFC1918-only Local Bridge", "Security gate", "Offline/PWA self-refresh"],
    guardrails: ["Không lưu hoặc proxy mật khẩu admin NC03", "Không gửi token/session modem lên cloud", "Không bật remote modem controls trong Manager", "Không đánh dấu connected chỉ vì runtime local mở được"],
  },
  {
    id: "cad-cam-3d", name: "CAD CAM 3D", shortName: "CAD CAM 3D", href: "/apps/cad-cam-3d",
    initials: "CAD", iconPath: "/app-icons/cad-cam-3d.svg", category: "Kỹ thuật", tier: "client", status: "warning", contractState: "pending",
    repository: "BlueDragon33/CAD_CAM_3D",
    scope: "Client CAD/3D-printing cấp 1 độc lập. Trung tâm quản lý thiết bị, policy giao diện, feature flags, print-policy và audit vận hành; CAD_CAM_3D tự sở hữu project, hình học, mesh và file xuất sản xuất.",
    contractNote: "CAD_CAM_3D đã công bố application-management contract và policy seam trên nhánh nền tảng. Remote Control API, registry CAD-, session/revoke và signed bridge chưa tồn tại nên mọi thao tác quản trị từ xa vẫn khóa cho tới khi backend thật được triển khai.",
    devicePolicy: "Registry CAD- riêng · desktop là workspace kỹ thuật đầy đủ · tablet/iPad touch-first · phone ưu tiên review/inspection · không dùng chung registry với Bauman hoặc client khác.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["Workspace CAD", "Policy giao diện", "Feature flags", "Print policy", "Thiết bị CAD-", "Audit vận hành", "Theo dõi runtime"],
    guardrails: ["Không sao chép CAD project vào Trung tâm", "Không lưu geometry/mesh/STL/STEP/3MF tại control-plane", "Không bật nút quản trị giả khi chưa có Control API", "Không dùng registry BM-/BE-/HN- cho thiết bị CAD"],
  },
  {
    id: "growup-mychildren", name: "GrowUP MyChildren", shortName: "GrowUP", href: "/apps/growup-mychildren", initials: "GU", iconPath: "/app-icons/growup-mychildren.svg", category: "Gia đình", tier: "client", status: "warning", contractState: "pending", repository: "BlueDragon33/GrowUP_MyChildren",
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

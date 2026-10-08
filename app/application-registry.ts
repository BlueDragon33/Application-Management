export type ApplicationStatus = "online" | "warning" | "planned";
export type ApplicationCategory = "Học tập" | "Y tế" | "Nga" | "Học thuật" | "Gia đình" | "Kế toán" | "Kỹ thuật";
export type AdminContractState = "connected" | "migrating" | "pending";
export type DeviceClass = "desktop" | "tablet" | "phone";
export type SubClientState = "independent" | "module" | "workflow" | "planned";

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
  kind: "subject-site" | "module" | "workflow";
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
  contractSource?: "repository";
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
  { id: "programming", name: "Lập trình", initials: "DEV", kind: "module", sourcePath: "subjects/programming", state: "module", contractState: "pending", note: "Module môn học thuộc Bauman Hub." },
  { id: "ai", name: "AI", initials: "AI", kind: "module", sourcePath: "subjects/ai", state: "module", contractState: "pending", note: "Module môn học thuộc Bauman Hub." },
  { id: "signal", name: "Tín hiệu", initials: "SIG", kind: "module", sourcePath: "subjects/signal", state: "module", contractState: "pending", note: "Module môn học thuộc Bauman Hub." },
  { id: "systems", name: "Hệ thống", initials: "SYS", kind: "module", sourcePath: "subjects/systems", state: "module", contractState: "pending", note: "Module môn học thuộc Bauman Hub." },
  { id: "foundation", name: "Nền tảng", initials: "FND", kind: "module", sourcePath: "subjects/foundation", state: "module", contractState: "pending", note: "Module nền tảng thuộc Bauman Hub." },
  { id: "entrepreneurship", name: "Cơ sở khởi nghiệp", initials: "ENT", kind: "module", sourcePath: "subjects/entrepreneurship", state: "module", contractState: "pending", note: "Module hỗ trợ HK2, được discovery qua manifest." },
  { id: "ergonomics", name: "Công thái học · HMI", initials: "HMI", kind: "module", sourcePath: "subjects/ergonomics", state: "module", contractState: "pending", note: "Module hỗ trợ HK3, được discovery qua manifest." },
  { id: "mivar", name: "Mivar Logical AI", initials: "MIV", kind: "module", sourcePath: "subjects/mivar", state: "module", contractState: "pending", note: "Module hỗ trợ HK4, được discovery qua manifest." },
  { id: "research", name: "Nghiên cứu", initials: "R&D", kind: "module", sourcePath: "subjects/research", state: "module", contractState: "pending", note: "Module NIR/VKR thuộc Bauman Hub." },
  { id: "russian", name: "Tiếng Nga", initials: "RU", kind: "module", sourcePath: "subjects/russian", state: "module", contractState: "pending", note: "Module Tiếng Nga riêng; không đồng nhất với học phần «Иностранный язык»." },
  { id: "foreign-language", name: "Ngoại ngữ học thuật", initials: "FL", kind: "module", sourcePath: "subjects/foreign-language", state: "module", contractState: "pending", note: "Module trung tính cho «Иностранный язык», không tự giả định ngôn ngữ." },
  { id: "security-elective", name: "Tự chọn 1 · Security", initials: "SEC", kind: "module", sourcePath: "subjects/security-elective", state: "module", contractState: "pending", note: "Module trung tính cho hai lựa chọn Bảo vệ thông tin / An toàn thông tin." },
  { id: "specialization-elective", name: "Tự chọn 2 · Big Data/Multimedia", initials: "EL2", kind: "module", sourcePath: "subjects/specialization-elective", state: "module", contractState: "pending", note: "Module trung tính cho hai lựa chọn Big Data / Multimedia." },
  { id: "practice-workflow", name: "Workflow thực tập", initials: "PR", kind: "workflow", sourcePath: "subjects/practice-workflow", state: "workflow", contractState: "pending", note: "Workflow checklist/nhật ký/minh chứng cho các slot thực tập và sư phạm; không giả lập thành môn lý thuyết." },
]

export const applicationRegistry: readonly ApplicationConfig[] = [
  {
    id: "software-blueprint-hub", name: "Software Blueprint Hub", shortName: "Blueprint OS", href: "/apps/software-blueprint-hub", publicUrl: "https://software-blueprint-hub.vercel.app/",
    contractSource: "repository",
    initials: "BP", category: "Kỹ thuật", tier: "client", status: "warning", contractState: "migrating",
    repository: "BlueDragon33/Software-Blueprint-Hub",
    scope: "Core Engineering Compass / “kim chỉ nam” của toàn hệ sinh thái. Blueprint OS tổ chức hệ thống theo kiến trúc 20 tầng: Constitution → Contract/Schema → Persistence → Blueprint Engine → Project Lifecycle → Planning → Quality → Prompt → UX → Knowledge → App-Manage Contract → Compass → Self-audit → Bootstrap Factory → Pattern Governance → Resilience → Secure Integrations → Bounded AI → Ecosystem Dogfooding → Acceptance Gate. Application Management chỉ quan sát lifecycle/readiness metadata; canonical engineering state vẫn thuộc Blueprint OS.",
    contractNote: "Blueprint OS đã PASS P9-019 và P9-020 và được phát hành tại Website riêng. Contract application-management.contract/v1 hiện chỉ xác minh metadata từ repository; liên kết Website không cấp Remote Admin, Device Gate, Quality Gate authority hoặc Production release authority cho Application Management.",
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
    capabilities: ["Lộ trình & môn học", "Study Plan 09.04.01/11", "Sub-client môn học", "Thiết bị BM-", "Duyệt/khóa truy cập", "P-256 Device Gate", "Session & thu hồi", "Audit Bauman", "Theo dõi trạng thái"],
    guardrails: ["Study Plan chỉ đọc contract/manifest Bauman và fail-closed khi registry không khả dụng", "Nút Website phải mở runtime học Bauman, không mở Control Service", "Không dùng hàng đợi Bơi ếch", "Sub-client thuộc Bauman không tự trở thành client cấp 1", "Không đánh dấu production connected chỉ vì CI xanh"],
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
    id: "pc-manager", name: "PC Manager Desktop", shortName: "PC Manager", href: "/apps/pc-manager",
    initials: "PC", category: "Kỹ thuật", tier: "client", status: "warning", contractState: "migrating",
    repository: "BlueDragon33/pc-manager-desktop",
    scope: "Ứng dụng Windows native quản lý sức khỏe, dọn dẹp, startup, ứng dụng, lưu trữ và giám sát máy tính. Kết nối Application Management bằng Desktop Agent Gateway outbound-only; không mở cổng inbound trên máy người dùng.",
    contractNote: "P8 Desktop Agent Gateway dùng P-256, heartbeat outbound, approval/entitlement/update policy và command envelope allow-list. Giữ trạng thái migrating cho tới khi gateway Production được cấu hình và handshake thật được xác minh.",
    devicePolicy: "Namespace PC- riêng · desktop-native Windows · pending/approved/blocked · online dựa trên heartbeat · private key thiết bị ở Windows CNG và không được đưa lên control-plane.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["Thiết bị PC-", "Duyệt/khóa thiết bị", "Heartbeat online/offline", "Release channel", "Entitlement", "Update policy", "Typed remote commands", "Audit"],
    guardrails: ["Chỉ outbound HTTPS từ PC Manager", "Không arbitrary shell/PowerShell/process/registry/download-and-run", "Không đưa filename/browsing history/document content lên Trung tâm", "Không đánh dấu connected chỉ vì CI xanh"],
  },
  {
    id: "nc03-modem", name: "NC03 Control Center", shortName: "NC03 Modem", href: "/apps/nc03-modem",
    localUrl: "/api/local-web-launch?app=nc03-modem",
    initials: "N3", iconPath: "/app-icons/nc03-modem.svg", category: "Kỹ thuật", tier: "client", status: "warning", contractState: "pending",
    repository: "BlueDragon33/NC03_Modem",
    scope: "Website-app/PWA local-first quản trị modem HYBRID Wi-Fi 5G NC03. Application Management quản lý lifecycle, release và điểm mở ứng dụng; credential/session modem luôn ở thiết bị người dùng.",
    contractNote: "NC03 Control Center v0.7.24 dùng runtime local độc lập qua network resolver. Launcher bắt buộc runtime v4 + auth-login v1 + write-readiness v1. AUTH chạy local-only và session được xác minh lại. Write Readiness Lab chỉ đọc/lập reversible capture plan; live write vẫn khóa tới khi có HAR write + rollback + post-condition.",
    devicePolicy: "Desktop/tablet/phone responsive · local-first · không đồng bộ mật khẩu/token/session modem lên control-plane · App Management chỉ mở runtime local, không proxy lệnh modem.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["Mở NC03 Control Center", "Runtime v4 + auth-login v1 + write-readiness v1 gate", "Real login local-only", "Session-expiry re-auth", "AES-GCM credential vault local", "Write Readiness Lab read-only", "Reversible Long Life Charging capture plan", "HAR Evidence Lab local-only", "AUTH/WRITE candidate separation", "Sanitized evidence export", "Live telemetry 10 giây không rerender trang", "Last-known-good + timestamp", "Pin % chính xác luôn hiển thị", "Kết nối + sóng + 4G/5G", "Advanced snapshot freshness + retry", "Báo cáo chẩn đoán A4 · In/Lưu PDF", "Report data-quality: 0 ≠ thiếu dữ liệu", "Live/Advanced freshness", "Privacy-safe report allow-list", "Mobile Data / SIM PIN / Cloud SIM read-only", "Firmware 8.00.42 HAR2 read profile", "4 Wi-Fi AP", "USB/Bridge/Security/NTP/Power/FOTA read-only", "Count-only DHCP/Port/Packet-filter inventory", "Thiết bị kết nối", "RFC1918-only Local Bridge", "Security gate", "Offline/PWA self-refresh"],
    guardrails: ["Application Management không lưu hoặc proxy mật khẩu admin NC03", "Credential vault chỉ thuộc NC03 local runtime trên thiết bị", "Không gửi token/session modem lên cloud", "Không bật remote modem controls trong Manager", "Không đánh dấu connected chỉ vì runtime local mở được"],
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
    id: "ecad-design", name: "ECAD Design", shortName: "ECAD Design", href: "/apps/ecad-design",
    initials: "ECAD", category: "Kỹ thuật", tier: "client", status: "planned", contractState: "pending",
    repository: "BlueDragon33/ECAD_Design",
    scope: "Client ECAD cấp 1 độc lập cho schematic, netlist, PCB, ERC/DRC, BOM và manufacturing intent. Trung tâm chỉ quản lý metadata vận hành/policy; dữ liệu điện tử và layout PCB vẫn thuộc ECAD_Design.",
    contractNote: "ECAD_Design đã có foundation B4, application-management boundary contract và namespace ECAD-. Chưa có runtime editor hay Control API production nên mọi thao tác quản trị từ xa vẫn khóa.",
    devicePolicy: "Registry ECAD- riêng · desktop là workspace điện tử đầy đủ · tablet touch-first khi phù hợp · phone ưu tiên review · không dùng chung registry CAD-/CAE-/BM-/BE-/HN-.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["Policy giao diện ECAD", "Feature flags", "Thiết bị ECAD-", "Audit vận hành", "Theo dõi runtime foundation"],
    guardrails: ["Không sao chép schematic/netlist/PCB project vào Trung tâm", "Không lưu Gerber/Drill/BOM/private design notes tại control-plane", "Không bật remote admin giả khi chưa có Control API", "Không làm ECAD thành nguồn chân lý cho CAD geometry"],
  },
  {
    id: "cae-simulation", name: "CAE Simulation", shortName: "CAE Simulation", href: "/apps/cae-simulation",
    initials: "CAE", category: "Kỹ thuật", tier: "client", status: "planned", contractState: "pending",
    repository: "BlueDragon33/CAE_Simulation",
    scope: "Client CAE cấp 1 độc lập cho simulation study, material/load/fixture/contact intent, mesh policy, solver runs và result evidence. Trung tâm chỉ quản lý metadata vận hành/policy; study, mesh và result fields vẫn thuộc CAE_Simulation.",
    contractNote: "CAE_Simulation đã có foundation B4, application-management boundary contract và namespace CAE-. Chưa chọn mesher/solver production và chưa có Control API nên mọi thao tác quản trị từ xa vẫn khóa.",
    devicePolicy: "Registry CAE- riêng · desktop ưu tiên study setup/result review · tablet thiên về review · phone chỉ review/inspection · không dùng chung registry CAD-/ECAD- hoặc client khác.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: ["Policy giao diện CAE", "Feature flags", "Thiết bị CAE-", "Audit vận hành", "Theo dõi solver/runtime foundation"],
    guardrails: ["Không sao chép study/mesh/solver result fields vào Trung tâm", "Không giả lập solver/convergence result", "Không bật remote admin giả khi chưa có Control API", "Không coi CI xanh là solver hay Production readiness"],
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

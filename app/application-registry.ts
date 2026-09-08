export type ApplicationStatus = "online" | "warning" | "planned";
export type AdminContractState = "connected" | "migrating" | "pending";

export type ApplicationConfig = {
  id: "boi-ech" | "health-care" | "ru-life" | "bauman-master-ai" | "growup-mychildren";
  name: string;
  shortName: string;
  href: string;
  initials: string;
  status: ApplicationStatus;
  contractState: AdminContractState;
  repository: string;
  scope: string;
  devicePolicy: string;
  capabilities: readonly string[];
  guardrails: readonly string[];
};

export const applicationRegistry: readonly ApplicationConfig[] = [
  {
    id: "boi-ech",
    name: "Bơi ếch AI",
    shortName: "Bơi ếch",
    href: "/apps/boi-ech",
    initials: "BE",
    status: "online",
    contractState: "connected",
    repository: "BlueDragon33/BOIECH_AI",
    scope: "Quản trị vận hành riêng của hệ thống học Bơi ếch.",
    devicePolicy: "Mã BE riêng · tự nhận diện máy tính, điện thoại, tablet/iPad · quyền truy cập và quyền sửa tách biệt.",
    capabilities: ["Thiết bị & truy cập", "Tiến độ học", "AI", "Thanh toán & thời hạn", "Duyệt nội dung"],
    guardrails: ["Không quản trị dữ liệu của ứng dụng khác", "Không cấp quyền quản trị Trung tâm", "Không dùng chung registry thiết bị với site khác"],
  },
  {
    id: "health-care",
    name: "Sức khỏe Y tế",
    shortName: "Sức khỏe Y tế",
    href: "/apps/health-care",
    initials: "YT",
    status: "warning",
    contractState: "migrating",
    repository: "BlueDragon33/Health_Care",
    scope: "Site sức khỏe độc lập; Trung tâm chỉ cấp quyền truy cập, chỉnh sửa, theo dõi trạng thái và kiểm duyệt.",
    devicePolicy: "Thiết bị riêng của Health_Care · tự phân loại máy tính, điện thoại, tablet/iPad · không lưu dữ liệu sức khỏe cá nhân tại Trung tâm.",
    capabilities: ["Thiết bị đầu vào", "Cấp/khóa truy cập", "Quyền chỉnh sửa", "Theo dõi vận hành", "Kiểm duyệt nội dung"],
    guardrails: ["Không chứa hồ sơ sức khỏe cá nhân", "Không dùng API/DB Bơi ếch", "Không gộp runtime với Trung tâm"],
  },
  {
    id: "ru-life",
    name: "Hòa nhập Nga",
    shortName: "Hòa nhập Nga",
    href: "/apps/ru-life",
    initials: "RU",
    status: "warning",
    contractState: "migrating",
    repository: "BlueDragon33/RU_LIFE",
    scope: "Site Hòa nhập Nga hoạt động độc lập; thiết bị phải được Trung tâm duyệt trước khi sử dụng.",
    devicePolicy: "Registry thiết bị riêng · nhận diện desktop/phone/tablet-iPad · quyền truy cập theo thiết bị, không đăng nhập trực tiếp trên site.",
    capabilities: ["Thiết bị đầu vào", "Cấp/khóa truy cập", "Phân loại thiết bị", "Quyền chỉnh sửa", "Theo dõi hoạt động"],
    guardrails: ["Không nhúng site vào Trung tâm", "Không chia sẻ registry Bơi ếch", "Không mở quyền trực tiếp ngoài control-plane"],
  },
  {
    id: "bauman-master-ai",
    name: "Bauman Master AI",
    shortName: "Bauman",
    href: "/apps/bauman-master-ai",
    initials: "BM",
    status: "warning",
    contractState: "pending",
    repository: "BlueDragon33/Bauman-master-ai-system",
    scope: "Quản trị lộ trình, môn học, thiết bị truy cập và contract dữ liệu của Bauman từ một khu quản trị riêng.",
    devicePolicy: "Áp dụng cùng chuẩn thiết bị đầu vào; chỉ bật khi backend quản trị Bauman cung cấp contract chính thức.",
    capabilities: ["Lộ trình & môn học", "Thiết bị truy cập", "Quyền chỉnh sửa", "Contract dữ liệu riêng", "Theo dõi trạng thái"],
    guardrails: ["Không mở thẳng site học từ Trung tâm", "Không dùng hàng đợi Bơi ếch", "Chỉ bật chức năng có backend thật"],
  },
  {
    id: "growup-mychildren",
    name: "GrowUP MyChildren",
    shortName: "GrowUP",
    href: "/apps/growup-mychildren",
    initials: "GU",
    status: "planned",
    contractState: "pending",
    repository: "BlueDragon33/GrowUP_MyChildren",
    scope: "Quản trị ứng dụng phát triển và học tập 3–18 tuổi theo mô hình site độc lập.",
    devicePolicy: "Chuẩn thiết bị đầu vào dùng chung về contract nhưng registry và dữ liệu phải thuộc riêng GrowUP.",
    capabilities: ["Thiết bị truy cập", "Quyền sửa", "Theo dõi tiến độ", "Kiểm duyệt cấu hình", "Audit"],
    guardrails: ["Không chuyển dữ liệu trẻ em về Trung tâm", "Không dùng DB ứng dụng khác", "Không bật quản trị khi chưa có contract"],
  },
];

export function getApplicationConfig(id: string) {
  return applicationRegistry.find((application) => application.id === id);
}

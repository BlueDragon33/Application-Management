export type ProjectRepositoryState = "operational" | "developing" | "prototype" | "scaffold";
export type ProjectRepositoryGroup = "core" | "learning" | "health" | "family" | "robotics" | "control" | "simulation" | "cad";

export type ProjectRepositoryConfig = {
  id: string;
  name: string;
  repository: string;
  defaultBranch: string;
  group: ProjectRepositoryGroup;
  state: ProjectRepositoryState;
  summary: string;
  managementHref?: string;
  relatedTo?: string;
};

export const projectRepositories: readonly ProjectRepositoryConfig[] = [
  {
    id: "application-management",
    name: "Quản trị Ứng dụng",
    repository: "BlueDragon33/Application-Management",
    defaultBranch: "main",
    group: "core",
    state: "operational",
    summary: "Control-plane trung tâm quản lý ứng dụng, thiết bị quản trị, quyền, đồng bộ và danh mục dự án.",
    managementHref: "/",
  },
  {
    id: "bauman-master-ai",
    name: "Bauman Master AI",
    repository: "BlueDragon33/Bauman-master-ai-system",
    defaultBranch: "main",
    group: "learning",
    state: "developing",
    summary: "Hub học tập Bauman, lộ trình thạc sĩ, môn học, Device Gate và Control Service riêng.",
    managementHref: "/apps/bauman-master-ai",
  },
  {
    id: "math-bauman",
    name: "Math Bauman",
    repository: "BlueDragon33/Math_Bauman",
    defaultBranch: "main",
    group: "learning",
    state: "developing",
    summary: "Site môn Toán Bauman độc lập với dữ liệu bài học, mô phỏng và subject manifest.",
    relatedTo: "Bauman Master AI",
  },
  {
    id: "boi-ech",
    name: "Bơi ếch AI",
    repository: "BlueDragon33/BOIECH_AI",
    defaultBranch: "main",
    group: "learning",
    state: "operational",
    summary: "Ứng dụng học Bơi ếch AI với thiết bị, tiến độ, kiểm duyệt nội dung và quyền truy cập riêng.",
    managementHref: "/apps/boi-ech",
  },
  {
    id: "health-care",
    name: "Sức khỏe Y tế",
    repository: "BlueDragon33/Health_Care",
    defaultBranch: "main",
    group: "health",
    state: "developing",
    summary: "Ứng dụng sức khỏe độc lập với Device Gate, Control API, session và registry riêng.",
    managementHref: "/apps/health-care",
  },
  {
    id: "ru-life",
    name: "Hòa nhập Nga",
    repository: "BlueDragon33/RU_LIFE",
    defaultBranch: "main",
    group: "learning",
    state: "developing",
    summary: "Ứng dụng hỗ trợ hòa nhập Nga, registry thiết bị HN, session và control contract riêng.",
    managementHref: "/apps/ru-life",
  },
  {
    id: "growup-mychildren",
    name: "GrowUP MyChildren",
    repository: "BlueDragon33/GrowUP_MyChildren",
    defaultBranch: "main",
    group: "family",
    state: "developing",
    summary: "Ứng dụng phát triển và học tập cho trẻ 3–18 tuổi theo hướng local-first và privacy-first.",
    managementHref: "/apps/growup-mychildren",
  },
  {
    id: "ros-1-2",
    name: "ROS 1/2",
    repository: "BlueDragon33/ROS-1-2",
    defaultBranch: "ros2",
    group: "robotics",
    state: "developing",
    summary: "Kho ROS cho robot/cảm biến; hiện có ROS 2 point-cloud to grid cho LiDAR, OccupancyGrid và GridMap.",
  },
  {
    id: "hardware-simulation",
    name: "Hardware Simulation",
    repository: "BlueDragon33/Hardware_Simulation",
    defaultBranch: "main",
    group: "simulation",
    state: "prototype",
    summary: "Virtual Hardware / Electronics Lab cho ESP32, breadboard, MNA solver, firmware workflow và 3D.",
  },
  {
    id: "mpc-pid-system",
    name: "MPC PID System",
    repository: "BlueDragon33/MPC_PID_System",
    defaultBranch: "main",
    group: "control",
    state: "developing",
    summary: "Control Research Workbench cho MPC/NMPC + Event Trigger + PID, benchmark và hướng tới HIL/phần cứng thật.",
  },
  {
    id: "cad-cam-3d",
    name: "CAD CAM 3D",
    repository: "BlueDragon33/CAD_CAM_3D",
    defaultBranch: "main",
    group: "cad",
    state: "scaffold",
    summary: "Nền tảng CAD/CAM 3D cho thiết kế chi tiết nhỏ, module UAV/USV/UGV và chuẩn bị mô hình cho in 3D.",
  },
];

export const projectRepositoryCount = projectRepositories.length;

export function githubRepositoryUrl(repository: string) {
  return `https://github.com/${repository}`;
}

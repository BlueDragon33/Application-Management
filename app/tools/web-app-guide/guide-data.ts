export type GateRisk = "read" | "source" | "preview" | "human" | "production" | "monitor";
export type ReleaseGate = {
  id: string;
  title: string;
  risk: GateRisk;
  objective: string;
  steps: readonly string[];
  evidence: readonly string[];
  stop: string;
};

export const guideVersion = "1.0.0 (09/11/2026)";
export const guideProjectName = "Web-App Engineering Playbook | Blueprint OS";
export const guideToolName = "Hướng dẫn lập trình Web-App · Web-App Engineering Playbook";

export const foundations = [
  { title: "Bài toán & phạm vi", detail: "Xác nhận người dùng, mục tiêu, chức năng được phép sửa, chức năng phải bảo toàn và tiêu chí hoàn tất." },
  { title: "Kiến trúc & sở hữu dữ liệu", detail: "Mỗi app có nguồn dữ liệu chuẩn, ranh giới API và quyền riêng; không nhân bản giao diện duyệt hay cơ sở dữ liệu." },
  { title: "Giao diện đã duyệt", detail: "Ghi mốc ảnh màn hình và blob/SHA trước khi chỉnh; so sánh desktop/mobile, quyền, điều hướng và trạng thái lỗi." },
  { title: "Chất lượng & an toàn", detail: "Kiểm thử đơn vị, hợp đồng, hồi quy, phân quyền, khả năng khôi phục; không sửa test để che lỗi." },
  { title: "Build & môi trường", detail: "Phân biệt local, Preview và Production; kiểm tra Node, lockfile, artifact, Worker, D1 ID, biến và secrets riêng." },
  { title: "Phát hành & bảo trì", detail: "Chốt exact SHA, reviewer và Owner, triển khai có kiểm soát, readback, ảnh thật, theo dõi và rollback tương thích." },
] as const;

// G0-G8 reflect the Vietnamese Cloudflare guide. These are instructional only;
// this route cannot mutate a repository, production worker or D1.
export const gates: readonly ReleaseGate[] = [
  {
    id:"G0",title:"Đóng băng và lập mốc hiện trạng",risk:"read",
    objective:"Không sửa khi chưa biết chính xác Worker, D1, giao diện và dữ liệu đang phục vụ.",
    steps:[
      "Chốt người chịu trách nhiệm, URL hai Worker và phạm vi sự cố; không chạy deploy.",
      "Đọc Cloudflare Deployments: Worker Version ID, traffic split và thời gian đổi phiên bản.",
      "Đối chiếu GitHub main SHA, workflow run, artifact và nhánh review của từng app.",
      "Đọc danh sách D1 name/UUID/bindings; kiểm tra quota FREE, không tạo/xóa database.",
      "Lưu ảnh giao diện được duyệt ở desktop/mobile và ảnh hiện tại cùng role/viewport.",
      "Ghi lỗi thật: Account-first 409, sai số 0, điều hướng, quyền, dữ liệu cũ, ảnh hưởng ứng dụng khác.",
    ],
    evidence:["Bảng 2 Worker + 2 D1 với URL/Version/UUID có nguồn xác minh","Mốc ảnh được duyệt và danh sách lỗi P0/P1","Checkpoint chính xác SHA và các việc BLOCKED"],
    stop:"Chưa biết phiên bản thực đang chạy, hoặc không có bản mốc đã được duyệt: DỪNG thay đổi."
  },
  {
    id:"G1",title:"Khoanh đúng phạm vi & thiết kế",risk:"read",
    objective:"Giữ BOIECH_AI UI trước publish và tất cả ứng dụng App-Management khác.",
    steps:[
      "Chốt UI chuẩn Bơi Ếch commit 01fcfed và UI App trước PR #381 commit f347bd0 làm mốc mã nguồn đối chiếu.",
      "Chỉ module Quản trị Bơi Ếch trong App-Management được làm mới theo giao diện Cán bộ quản lý trước publish.",
      "Tách quyền Owner trung tâm, quản trị Bơi Ếch và quyền học viên; không mở hồ sơ cá nhân không cần thiết.",
      "Khoanh danh sách tệp thay đổi dự kiến; loại mọi app, dashboard, migration không liên quan.",
      "Lập sơ đồ API caller → bridge → Bơi Ếch và trạng thái 200/401/403/409.",
    ],
    evidence:["Danh sách tệp cho phép và tệp cấm","Ảnh/UI reference và acceptance checklist","Sơ đồ ranh giới API/quyền"],
    stop:"Nếu PR chạm ứng dụng khác hoặc nguồn dữ liệu chung ngoài phạm vi: tách PR, không merge."
  },
  {
    id:"G2",title:"Sửa đúng hợp đồng và nghiệp vụ",risk:"source",
    objective:"Khôi phục API V2 đúng quyền, không giả số liệu và không thay đổi giao diện đã duyệt.",
    steps:[
      "Tái hiện HTTP 409 ACCOUNT_CONTROL_REQUIRED trong đường gọi App-Management → Bơi Ếch.",
      "Thiết kế API V2 versioned read-only cho thống kê cho phép, tách rõ dữ liệu riêng tư.",
      "Bổ sung adapter chỉ cho module Bơi Ếch; không mở lại legacy write hoặc tạo thêm bảng quản trị.",
      "Trả trạng thái chưa xác minh khi upstream fail, không hiển thị số 0 giả hoặc xóa cache gốc.",
      "Thêm regression 200/401/403/409, thiếu secret, MFA, thiết bị chưa duyệt, dữ liệu cũ.",
    ],
    evidence:["Tái hiện lỗi trước và hết lỗi sau ở đúng endpoint","Contract test cặp hai repo","Diff chỉ trong API/module chủ sở hữu"],
    stop:"Nếu không chứng minh được chủ sở hữu dữ liệu/role/scope: không viết adapter đặc quyền."
  },
  {
    id:"G3",title:"Kiểm thử mã nguồn và migration cục bộ",risk:"source",
    objective:"PASS đúng SHA đã build, gồm hành vi cũ, chức năng mới và dữ liệu lịch sử.",
    steps:[
      "Checkout đúng commit/branch; dùng Node 22.13.0 và npm ci theo lockfile.",
      "Chạy test được cấu hình của từng repository; không bỏ test cũ.",
      "Chạy lint, typecheck, build, kiểm tra hiến pháp và artifact hash.",
      "Diễn tập toàn bộ migration SQL trên D1 local riêng, tuyệt đối không --remote.",
      "Diễn tập nâng cấp từ snapshot dữ liệu mẫu cũ, xác nhận không mất hồ sơ/chứng chỉ.",
      "Ghi SHA, run ID, số test PASS/FAIL, danh sách file thay đổi và lỗi còn lại.",
    ],
    evidence:["CI xanh ở exact SHA, không bỏ qua test","Migration local và legacy-upgrade rehearsal","Danh sách regression hành vi cũ"],
    stop:"Bất kỳ test bảo vệ P0/P1 FAIL hoặc migration chưa chứng minh tương thích: sửa tại nhánh."
  },
  {
    id:"G4",title:"Nghiệm thu hạ tầng Preview cô lập",risk:"preview",
    objective:"Hai Worker/D1 Preview thật, bí mật và dữ liệu khác Production.",
    steps:[
      "Xác minh quota D1 FREE, name/UUID, secrets hiện hữu bằng quyền chỉ đọc.",
      "Review workflow Preview và SHA hai repo; không dùng SHA ghim cũ hoặc tự mở if:false.",
      "Đảm bảo Preview Origin, D1 UUID và Owner bridge secret tách Production.",
      "Lưu backup/rollback thích hợp trước migration trên Preview.",
      "Chạy Preview có phê duyệt riêng và build/artifact check trước remote D1 migration.",
      "Đọc lại HTTPS, Worker version, JS/CSS assets, D1 bindings và feature flags thực tế.",
      "Giữ nguyên Production; kiểm tra hai Worker cùng hợp đồng API versioned.",
    ],
    evidence:["D1 Preview khác UUID Production","Live readback hai Worker đúng SHA","Record phê duyệt Preview và migration output"],
    stop:"D1 thiếu chỗ, secret/URL không xác minh, hoặc Preview dùng Production binding: DỪNG."
  },
  {
    id:"G5",title:"Nghiệm thu UI và hành vi thật",risk:"preview",
    objective:"Không thay giao diện được duyệt và không báo thành công từ fixture thay cho browser thật.",
    steps:[
      "Chụp ảnh cùng viewport/role/zoom của giao diện mẫu và Preview.",
      "So desktop, mobile 390×844 và tablet 768×1024: menu, cards, dock, modal, button.",
      "Thử Owner, reviewer, teacher, learner; hai vòng duyệt, MFA, 3 thiết bị và quyền thu hồi.",
      "Thử offline/online, xung đột, readback, thời hạn tài khoản và giữ điểm/chứng chỉ.",
      "Thử lỗi 401/403/409, mạng bị ngắt, trạng thái chưa xác minh; không giả 0 dữ liệu.",
    ],
    evidence:["Ảnh thực tế được Owner duyệt","Kết quả E2E hai Worker và các role","Dữ liệu cũ được đọc lại mà không mất"],
    stop:"Khác giao diện chuẩn, sai quyền hoặc chưa kiểm chứng E2E: không mở Release gate."
  },
  {
    id:"G6",title:"Review độc lập và chốt phát hành",risk:"human",
    objective:"Một manifest ghi đủ bằng chứng, người chịu trách nhiệm và exact SHA.",
    steps:[
      "Reviewer độc lập kiểm tra UI, API, quyền, dữ liệu, kiến trúc và phạm vi diff.",
      "Xác nhận không còn P0/P1, không có regression ở ứng dụng khác.",
      "Chốt exact SHA của hai repo, hash artifact và release manifest.",
      "Owner phê duyệt môi trường, hành động, SHA và kịch bản rollback riêng.",
    ],
    evidence:["Biên bản reviewer độc lập","Xác nhận UX của Owner","Release manifest exact SHA/hashes/rollback"],
    stop:"Thiếu bất kỳ phê duyệt bắt buộc: BLOCKED, không coi CI thành lệnh publish."
  },
  {
    id:"G7",title:"Publish Production có kiểm soát",risk:"production",
    objective:"Chỉ phát hành bản được duyệt, không mượn sai D1 hay deploy lại toàn App tùy tiện.",
    steps:[
      "Chạy INSPECT_PRODUCTION (nếu workflow hỗ trợ) trước khi xin phát hành.",
      "Xác minh bảng backup D1/Worker Version, số migration pending và tương thích rollback.",
      "Đối chiếu exact SHA approved với checkout và artifact được build.",
      "Dùng workflow manual đã phê duyệt và đúng tên Worker/domain; không chạy khi còn if:false.",
      "Đọc lại Worker Version + API identity + JS/CSS và kiểm tra vai trò thực tế.",
      "Mở trang thật desktop/mobile và dừng nếu giao diện/role lệch baseline.",
    ],
    evidence:["Workflow run có quyền Owner đúng SHA","Worker Version và URL/asset readback","Ảnh Production và report sau phát hành"],
    stop:"Không có authority Production hoặc chỉ có CI PASS: tuyệt đối không triển khai."
  },
  {
    id:"G8",title:"Theo dõi, phục hồi và đóng đợt",risk:"monitor",
    objective:"Không đóng phiên vì deploy xanh; phải thấy sản phẩm thật hoạt động đúng.",
    steps:[
      "So ảnh giao diện Production với mẫu, cùng browser/role.",
      "Đọc lại tiến độ, quyền, tài khoản, bản ghi cũ và chứng chỉ bằng truy vấn hợp lệ.",
      "Kiểm tra 401/403/409, latency, Workers errors và lỗi phiên.",
      "Nếu sai: đóng băng, phân loại Worker/asset/flag/secret/D1; không rollback D1 theo cảm tính.",
      "Rollback Worker chỉ khi kiểm tra tương thích schema và được Owner cho phép; lưu checkpoint.",
    ],
    evidence:["Báo cáo hậu triển khai exact SHA và Version ID","UI acceptance + API/canonical-data readback","Rollback/monitoring checkpoint"],
    stop:"Nếu có regression nghiêm trọng: mở P0 và dừng các lần publish tiếp theo."
  }
];

export const workflowRules = [
  { id:"R7", title:"Vòng sửa lỗi có bằng chứng", detail:"Một vòng: xác định lỗi → sửa đúng owner/scope → test trọng điểm và hồi quy liên quan → đánh giá. Một lỗi tối đa 3 phương án sửa khác nhau không thành công trước khi dừng vá thử và điều tra lại." },
  { id:"R16", title:"Một đường găng, ít hàng đợi", detail:"Một ACTIVE Next Action; việc độc lập không đụng cùng tệp/SHA mới được song song. Không mở thêm dashboard hay module không cần thiết." },
  { id:"R19", title:"Chỉ bàn giao khi thật sự cần quyền", detail:"Lỗi kỹ thuật tự sửa trong giới hạn; cần Work/người khi thiếu quyền đăng nhập, tài nguyên bảo vệ hoặc phê duyệt/UX bắt buộc." },
  { id:"R20", title:"Không đánh đồng trạng thái", detail:"CODE COMPLETE, TEST VERIFIED, MERGED, DEPLOYED, USER ACCEPTED là năm trạng thái khác nhau, không suy từ nhau." },
] as const;

export const executionRecommendations = [
  { id:"inspect", label:"Đọc & phân tích", combine:"G0 + G1", rounds:2, steps:11, rule:"Có thể gộp trong một phiên: chỉ đọc, cùng hệ thống, đủ bằng chứng; không đụng Production." },
  { id:"source", label:"Sửa mã và kiểm thử", combine:"G2 + G3", rounds:2, steps:11, rule:"Có thể gộp sửa nhỏ và QA vào một phiên nếu test PASS. FAIL phải quay về chẩn đoán, không vá lặp." },
  { id:"preview", label:"Preview & UX", combine:"G4 → G5", rounds:1, steps:7, rule:"G4 là một lượt có quyền riêng; G5 có thể bắt đầu cùng phiên khi Preview thực sự PASS, nhưng kết thúc cần người nghiệm thu." },
  { id:"release", label:"Duyệt và phát hành", combine:"G6 | G7 | G8", rounds:1, steps:6, rule:"Không gộp quyết định Owner, triển khai Production và tuyên bố nghiệm thu. Sau G7 phải lập tức kiểm tra G8, nhưng chỉ được đóng khi có chứng cứ." },
] as const;

export const referenceLinks = [
 {name:"BOIECH_AI Issue #108",href:"https://github.com/BlueDragon33/BOIECH_AI/issues/108"},
 {name:"App-Management Issue #379",href:"https://github.com/BlueDragon33/Application-Management/issues/379"},
 {name:"Blueprint OS 1.3.0",href:"https://github.com/BlueDragon33/Software-Blueprint-Hub/blob/main/docs/UNIVERSAL-CONSTITUTION.md"},
 {name:"Cloudflare Workers Deployments",href:"https://developers.cloudflare.com/workers/configuration/versions-and-deployments/"},
 {name:"Cloudflare D1",href:"https://developers.cloudflare.com/d1/"},
] as const;

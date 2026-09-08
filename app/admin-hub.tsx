import { BAUMAN_HUB_URL } from "./bauman-registry";
import { integrationRussiaSiteUrl } from "./site-links";

/* eslint-disable @next/next/no-html-link-for-pages -- the Sites preview relies on full navigation between independently deployed applications. */

type HubStatus = "connected" | "planned";
type HubTone = "bauman" | "learning" | "health" | "russia";

type ManagedApplication = {
  id: string;
  index: string;
  category: string;
  name: string;
  description: string;
  tone: HubTone;
  status: HubStatus;
  manageHref: string | null;
  manageLabel: string;
  webHref: string | null;
  webLabel: string;
  parts: string[];
  boundary: string;
};

const applications: ManagedApplication[] = [
  {
    id: "bauman",
    index: "01",
    category: "HỌC TẬP · BAUMAN",
    name: "BAUMAN MASTER HUB",
    description: "Hub điều phối lộ trình, lịch học, học liệu và các Web App môn học độc lập.",
    tone: "bauman",
    status: "connected",
    manageHref: "/bauman-control",
    manageLabel: "Quản trị Bauman ↗",
    webHref: BAUMAN_HUB_URL,
    webLabel: "Mở Hub ↗",
    parts: ["Hub & lộ trình", "8 môn độc lập", "Trạng thái kết nối"],
    boundary: "Khu quản trị Bauman điều phối Hub; Web App Hub và nội dung từng môn vẫn là các Site độc lập.",
  },
  {
    id: "boi-ech",
    index: "02",
    category: "HỌC TẬP · BƠI ẾCH",
    name: "BƠI ẾCH AI",
    description: "Ứng dụng học bơi, theo dõi thiết bị học, tiến độ, thanh toán và nội dung.",
    tone: "learning",
    status: "connected",
    manageHref: "/learning-control",
    manageLabel: "Quản trị Bơi ếch",
    webHref: "https://boi-ech.boiech-ai.workers.dev",
    webLabel: "Mở Web App ↗",
    parts: ["Thiết bị & tài khoản", "Tiến độ và học liệu", "AI, thanh toán và duyệt sửa"],
    boundary: "Nội dung bài học vẫn được chỉnh sửa tại Site Bơi ếch; Trung tâm quản lý quyền và quy trình.",
  },
  {
    id: "suc-khoe",
    index: "03",
    category: "Y TẾ · SỨC KHỎE",
    name: "SỨC KHỎE TRẺ",
    description: "Site sức khỏe độc lập, tách dữ liệu và cơ sở dữ liệu khỏi ứng dụng Bơi ếch.",
    tone: "health",
    status: "connected",
    manageHref: "/medical-control",
    manageLabel: "Vào quản trị Y tế",
    webHref: "https://suc-khoe-tre.boiech-ai.workers.dev/suc-khoe-tre",
    webLabel: "Mở Site Sức khỏe ↗",
    parts: ["Nội dung sức khỏe", "Phiên bản & kiểm duyệt", "Audit và quyền biên tập"],
    boundary: "Sức khỏe trẻ dùng Worker và D1 riêng; không dùng runtime, API hoặc dữ liệu Bơi ếch.",
  },
  {
    id: "hoa-nhap-nga",
    index: "04",
    category: "NGA · HÒA NHẬP",
    name: "HÒA NHẬP NGA",
    description: "Web App độc lập; thiết bị truy cập phải được Site Quản trị nhận diện và cấp quyền trước khi sử dụng.",
    tone: "russia",
    status: "connected",
    manageHref: "/medical-control",
    manageLabel: "Quản lý thiết bị Hòa nhập Nga",
    webHref: integrationRussiaSiteUrl,
    webLabel: "Mở Web App ↗",
    parts: ["Thiết bị HN & trạng thái", "Cấp quyền / thu hồi / khóa", "Kiểm duyệt & thống kê"],
    boundary: "Hòa nhập Nga chạy ở Site riêng. Trung tâm chỉ quản lý quyền theo thiết bị, kiểm duyệt và dữ liệu điều hành; không chạy giao diện người dùng Hòa nhập Nga.",
  },
];

const statusLabel: Record<HubStatus, string> = {
  connected: "ĐÃ KẾT NỐI",
  planned: "CHỜ KẾT NỐI",
};

function ExternalLink({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

function ApplicationCard({ application }: { application: ManagedApplication }) {
  return (
    <article className={`application-card tone-${application.tone} ${application.status === "planned" ? "is-planned" : ""}`}>
      <header className="application-card-header">
        <span className="application-index">{application.index}</span>
        <span className={`application-status status-${application.status}`}><i />{statusLabel[application.status]}</span>
      </header>

      <div className="application-card-heading">
        <span>{application.category}</span>
        <h2>{application.name}</h2>
        <p>{application.description}</p>
      </div>

      <div className="application-actions">
        {application.manageHref ? (
          application.manageHref.startsWith("/") ? <a className="hub-button primary" href={application.manageHref}>{application.manageLabel}</a> : <ExternalLink className="hub-button primary" href={application.manageHref}>{application.manageLabel}</ExternalLink>
        ) : <span className="hub-button disabled">{application.manageLabel}</span>}
        {application.webHref ? <ExternalLink className="hub-button" href={application.webHref}>{application.webLabel}</ExternalLink> : <span className="hub-button disabled secondary">{application.webLabel}</span>}
      </div>

      <div className="application-parts">
        <span className="application-parts-label">CÁC PHẦN QUẢN LÝ</span>
        <ul>{application.parts.map((part) => <li key={part}>{part}</li>)}</ul>
      </div>

      <p className="application-boundary"><strong>Ranh giới:</strong> {application.boundary}</p>
    </article>
  );
}

export default function AdminHub({ user }: { user: { displayName: string; email: string } }) {
  const connectedCount = applications.filter((application) => application.status === "connected").length;
  const managedCount = applications.filter((application) => application.manageHref).length;

  return (
    <main className="admin-hub">
      <header className="admin-hub-topbar">
        <a className="admin-hub-brand" href="/" aria-label="Về trang chủ Quản trị ứng dụng">
          <span className="admin-hub-seal">QT</span>
          <span><small>TRUNG TÂM ĐIỀU PHỐI</small><strong>QUẢN TRỊ ỨNG DỤNG</strong></span>
        </a>
        <div className="admin-hub-account">
          <div><span>Tài khoản ChatGPT đang dùng</span><strong>{user.displayName}</strong><small>{user.email}</small></div>
          <a href="/logout?return_to=/login">Đăng xuất</a>
        </div>
      </header>

      <section className="admin-hub-hero">
        <div className="hero-copy">
          <span className="hero-kicker">APPLICATION CONTROL PLANE</span>
          <h1>QUẢN TRỊ<br /><em>ỨNG DỤNG</em></h1>
          <p>Một điểm điều phối cho các Site đang sử dụng. Chọn đúng ứng dụng để mở phần quản trị riêng, còn runtime, dữ liệu và quyền của từng Site được tách theo đúng ranh giới.</p>
          <div className="hero-rule"><span /> <b>Lĩnh vực → Ứng dụng → Phần quản lý</b></div>
        </div>
        <aside className="hero-account-card">
          <span className="hero-card-label">ĐỊNH DANH QUẢN TRỊ</span>
          <strong>{user.email}</strong>
          <p>Đăng nhập này chỉ dành cho Site Quản trị. Quyền vào Hòa nhập Nga được quyết định riêng theo thiết bị HN, không kế thừa từ tài khoản quản trị.</p>
          <div className="hero-account-status"><i /> Thiết bị quản trị đã xác thực</div>
        </aside>
      </section>

      <section className="hub-summary" aria-label="Tổng quan kết nối">
        <div><span>Site đã kết nối</span><strong>{connectedCount}</strong><small>Bauman · Bơi ếch · Sức khỏe · Hòa nhập Nga</small></div>
        <div><span>Điểm quản trị</span><strong>{managedCount}</strong><small>Điều hướng theo từng ứng dụng</small></div>
        <div><span>Site chờ kết nối</span><strong>{applications.length - connectedCount}</strong><small>Có thể mở rộng thêm</small></div>
        <div><span>Tài khoản quản trị</span><strong>ChatGPT</strong><small>Không thay thế quyền thiết bị Site con</small></div>
      </section>

      <section className="application-section" aria-labelledby="applications-heading">
        <div className="section-heading">
          <div><span className="hero-kicker">APPLICATION REGISTRY</span><h2 id="applications-heading">Các ứng dụng đang được điều phối</h2></div>
          <p>Nhấn <b>Quản trị</b> để vào khu vực kiểm soát tương ứng. Nhấn <b>Mở Web App</b> để mở Site riêng; Site đó tự kiểm tra quyền thiết bị của nó.</p>
        </div>
        <div className="application-grid">{applications.map((application) => <ApplicationCard key={application.id} application={application} />)}</div>
      </section>

      <section className="control-principles" aria-labelledby="principles-heading">
        <div><span className="hero-kicker">CONTROL PRINCIPLES</span><h2 id="principles-heading">Một Trung tâm, nhiều Site độc lập.</h2></div>
        <div className="principle-list"><article><b>01</b><strong>Quản trị tập trung</strong><p>Tài khoản ChatGPT chỉ xác thực người quản trị và thiết bị quản trị.</p></article><article><b>02</b><strong>Quyền Site con tách biệt</strong><p>Mỗi ứng dụng có registry/quy trình quyền riêng; Hòa nhập Nga dùng quyền theo thiết bị HN.</p></article><article><b>03</b><strong>Mở rộng có kiểm soát</strong><p>Site mới thêm hợp đồng quản trị rõ ràng mà không đưa runtime người dùng vào Trung tâm.</p></article></div>
      </section>

      <footer className="admin-hub-footer"><span>QUẢN TRỊ ỨNG DỤNG</span><p>Điều phối tập trung · runtime phân tách · quyền truy cập có kiểm soát</p><a href="/system-control">Quản trị hệ thống →</a></footer>
    </main>
  );
}
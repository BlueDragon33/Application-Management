"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { connectAdminCenter, roleLabels, type AdminAccess } from "../../admin-device-client";
import type { ApplicationConfig } from "../../application-registry";
import styles from "../../application-admin.module.css";

type View = "overview" | "interface" | "devices" | "contract";

const readiness = [
  ["Runtime CAD", "available", "Workspace React/TypeScript/Three.js đã có trên nhánh nền tảng."],
  ["Management contract", "available", "CAD_CAM_3D đã công bố control/application-management.contract.json."],
  ["UI policy seam", "available", "Policy giao diện/feature flags đã tách khỏi dữ liệu project."],
  ["Registry CAD-", "missing", "Chưa có registry thiết bị CAD độc lập ở backend."],
  ["Signed Device Gate", "missing", "Chưa có challenge/authorize/session cho thiết bị CAD."],
  ["CAD Control API", "missing", "Chưa có API quản trị từ xa cho interface policy, feature flags và print policy."],
  ["Remote audit", "missing", "Chưa có endpoint audit metadata an toàn."],
  ["Production Site", "missing", "Chưa có public URL đã xác minh contract."],
] as const;

const managedPolicy = [
  ["Mật độ workspace", "Engineering", "Desktop ưu tiên workspace kỹ thuật nhiều thông tin."],
  ["AI command bridge", "Bật", "Có thể được control-plane bật/tắt sau khi bridge thật tồn tại."],
  ["Print validation", "Bật", "Kiểm tra kích thước và policy in luôn là lớp độc lập với CAD geometry."],
  ["Experimental CAD", "Tắt", "Feature thử nghiệm không tự bật cho người dùng."],
  ["Điện thoại", "Review only", "Ưu tiên xem/kiểm tra; không ép full authoring trên màn hình nhỏ."],
] as const;

function Gate({ access, busy, error, retry }: { access: AdminAccess | null; busy: boolean; error: string; retry: () => void }) {
  return (
    <main className={styles.workspaceGate}>
      <section>
        <span className={styles.workspaceGateMark}>CAD</span>
        <small>CAD CAM 3D · ADMIN GATE</small>
        <h1>{access?.status === "pending" ? "Thiết bị quản trị đang chờ cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Đang xác thực khu quản trị CAD CAM 3D…"}</h1>
        <p>{error || "Khu quản trị CAD chỉ mở trên thiết bị quản trị đã được Quản trị Ứng dụng duyệt."}</p>
        {access?.deviceCode ? <div className={styles.workspaceGateCode}><span>Mã thiết bị quản trị</span><strong>{access.deviceCode}</strong></div> : null}
        <button onClick={retry} disabled={busy}>{busy ? "Đang kiểm tra…" : "Kiểm tra lại"}</button>
      </section>
    </main>
  );
}

export default function CadAdmin({ application, user }: { application: ApplicationConfig; user: { displayName: string; email: string } }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [view, setView] = useState<View>("overview");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setBusy(true);
    setError("");
    try {
      const result = await connectAdminCenter();
      setAccess(result.access);
      if (result.access.status === "approved" && !result.bootstrap) {
        setError("Không thể xác nhận control-plane của thiết bị quản trị.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể xác thực khu quản trị CAD CAM 3D.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!access || access.status !== "approved") {
    return <Gate access={access} busy={busy} error={error} retry={() => void load()} />;
  }

  const available = readiness.filter((item) => item[1] === "available").length;
  const title = view === "interface"
    ? ["INTERFACE POLICY", "Quản lý giao diện CAD", "Policy giao diện được đặt dưới Quản trị Ứng dụng nhưng chỉ được đẩy sang CAD khi Control API thật tồn tại."]
    : view === "devices"
      ? ["CAD DEVICE BOUNDARY", "Thiết bị & quyền truy cập", "Thiết bị CAD dùng namespace riêng và không kế thừa quyền từ Bauman hay client khác."]
      : view === "contract"
        ? ["REMOTE ADMIN CONTRACT", "Độ sẵn sàng quản trị từ xa", "Chỉ capability có backend thật mới được phép trở thành thao tác quản trị."]
        : ["CAD CAM 3D · CLIENT CONTROL", "Quản trị CAD CAM 3D", "Client CAD cấp 1 cho thiết kế chi tiết nhỏ, in 3D và mở rộng UAV/USV/UGV theo module."];

  return (
    <main className={styles.workspaceShell}>
      <aside className={styles.clientSidebar}>
        <Link href="/" className={styles.serverBack}><span>←</span><div><small>SERVER</small><strong>Application Management</strong></div></Link>
        <div className={styles.clientBrand}><span>CAD</span><div><small>CLIENT CẤP 1</small><strong>CAD CAM 3D</strong></div></div>
        <div className={styles.clientStatus}><i data-status="warning"/><div><strong>Đã vào control-plane</strong><small>Remote bridge đang xây dựng</small></div></div>

        <nav className={styles.clientNav}>
          <span className={styles.navGroup}>QUẢN TRỊ CAD CAM 3D</span>
          <button data-active={view === "overview"} onClick={() => setView("overview")}><span>01</span><div><strong>Tổng quan</strong><small>Runtime & phạm vi</small></div></button>
          <button data-active={view === "interface"} onClick={() => setView("interface")}><span>02</span><div><strong>Giao diện</strong><small>UI policy & feature flags</small></div></button>
          <button data-active={view === "devices"} onClick={() => setView("devices")}><span>03</span><div><strong>Thiết bị</strong><small>Registry CAD-</small></div></button>
          <button data-active={view === "contract"} onClick={() => setView("contract")}><span>04</span><div><strong>Contract</strong><small>{available}/{readiness.length} sẵn sàng</small></div></button>
        </nav>

        <div className={styles.clientBoundary}>
          <span>RANH GIỚI</span>
          <strong>Không đưa project CAD vào Application Management.</strong>
          <p>Control-plane quản lý policy và quyền; geometry, mesh, STL/STEP/3MF vẫn thuộc CAD_CAM_3D.</p>
        </div>

        <div className={styles.clientUser}><span>{user.displayName.slice(0,1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabels[access.role]}</small><small>{access.deviceCode}</small></div></div>
      </aside>

      <section className={styles.workspaceMain}>
        <header className={styles.workspaceTopbar}>
          <div><span>{title[0]}</span><h1>{title[1]}</h1><p>{title[2]}</p></div>
          <div className={styles.topbarActions}>
            {application.publicUrl ? <a href={application.publicUrl} target="_blank" rel="noreferrer">Mở CAD CAM 3D ↗</a> : null}
            <Link href="/">Hệ thống</Link>
            <button onClick={() => void load()} disabled={busy}>{busy ? "Đang cập nhật…" : "Cập nhật"}</button>
          </div>
        </header>

        {error ? <div className={styles.workspaceError}>{error}</div> : null}

        {view === "overview" ? <>
          <section className={styles.clientMetrics}>
            <article><span>Client</span><strong>Cấp 1</strong><small>CAD/3D printing độc lập</small></article>
            <article data-state="ready"><span>Contract</span><strong>Đã công bố</strong><small>Control-plane boundary</small></article>
            <article data-state="pending"><span>Remote admin</span><strong>Chưa bật</strong><small>Chờ Control API thật</small></article>
            <article data-state="pending"><span>Website</span><strong>{application.publicUrl ? "Đã cấu hình" : "Chưa publish"}</strong><small>{application.publicUrl ? "Có thể mở runtime" : "Không tạo link giả"}</small></article>
          </section>

          <section className={styles.clientPanel}>
            <div className={styles.panelHeader}><div><span>CONTROL SCOPE</span><h2>Quản trị vận hành, không gom dữ liệu thiết kế</h2></div><p>CAD_CAM_3D là runtime kỹ thuật độc lập; Trung tâm chỉ điều phối policy, quyền, trạng thái và audit metadata an toàn.</p></div>
            <div className={styles.contractSummary}>
              <div><span>Repository</span><strong>{application.repository}</strong></div>
              <div><span>Runtime</span><strong>CAD_CAM_3D sở hữu</strong></div>
              <div><span>Project/Geometry</span><strong>Không đưa lên control-plane</strong></div>
              <div><span>Remote operations</span><strong>Đang khóa</strong></div>
            </div>
          </section>

          <section className={styles.clientPanel}>
            <div className={styles.panelHeader}><div><span>CAPABILITIES</span><h2>Phạm vi quản trị đã định nghĩa</h2></div><p>Các capability được đăng ký ngay từ đầu để sau này nối backend không phải thay đổi cấu trúc giao diện quản trị.</p></div>
            <div className={styles.capabilityList}>{application.capabilities.map((item,index) => <article key={item}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{item}</strong><small>{index < 4 ? "Policy surface đã định nghĩa" : "Chờ backend CAD"}</small></div><i data-contract={index < 4 ? "connected" : "pending"}/></article>)}</div>
          </section>
        </> : null}

        {view === "interface" ? <>
          <section className={styles.clientPanel}>
            <div className={styles.panelHeader}><div><span>MANAGED UI POLICY</span><h2>Giao diện CAD nằm dưới control-plane</h2></div><p>Đây là policy hiện tại trong CAD_CAM_3D. Chưa bật nút ghi từ xa cho tới khi signed Control API tồn tại.</p></div>
            <div className={styles.capabilityList}>{managedPolicy.map((item,index) => <article key={item[0]}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{item[0]} · {item[1]}</strong><small>{item[2]}</small></div><i data-contract="connected"/></article>)}</div>
          </section>
          <section className={styles.boundaryNotice}><span>!</span><div><strong>Không mô phỏng thao tác quản trị.</strong><p>Control UI đã được chuẩn bị theo cùng shell với Bauman. Khi CAD Control API có thật, các policy trên mới được biến thành control tương tác và phải có audit/idempotency đầy đủ.</p></div></section>
        </> : null}

        {view === "devices" ? <>
          <section className={styles.clientPanel}>
            <div className={styles.panelHeader}><div><span>DEVICE POLICY</span><h2>Registry CAD- độc lập</h2></div><p>Quyền thiết bị CAD không kế thừa từ thiết bị học Bauman, Bơi ếch, Sức khỏe hay Hòa nhập Nga.</p></div>
            <div className={styles.contractSummary}>
              <div><span>Namespace</span><strong>CAD-</strong></div>
              <div><span>Desktop</span><strong>Full engineering workspace</strong></div>
              <div><span>Tablet/iPad</span><strong>Touch-first</strong></div>
              <div><span>Phone</span><strong>Review / inspection</strong></div>
            </div>
          </section>
          <section className={styles.boundaryNotice}><span>!</span><div><strong>Device approval đang khóa.</strong><p>Chưa có registry CAD-, challenge ký số và session ledger nên Trung tâm không hiển thị nút duyệt/khóa thiết bị CAD giả.</p></div></section>
        </> : null}

        {view === "contract" ? <>
          <section className={styles.clientPanel}>
            <div className={styles.panelHeader}><div><span>READINESS</span><h2>Điều kiện để bật quản trị thật</h2></div><p>Nguồn contract của client: `control/application-management.contract.json` trong CAD_CAM_3D.</p></div>
            <div className={styles.capabilityList}>{readiness.map((item,index) => <article key={item[0]}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{item[0]}</strong><small>{item[2]}</small></div><i data-contract={item[1] === "available" ? "connected" : "pending"}/></article>)}</div>
            <div className={styles.guardrailBlock}><span>GATE</span><p>• Giao diện quản trị dùng approved-admin-device gate giống các app khác.</p><p>• Registry phải là CAD- riêng.</p><p>• Project/geometry/mesh/export không được sao chép vào control-plane.</p><p>• UI policy và feature flags chỉ được ghi khi Control API thật tồn tại.</p><p>• Production URL chỉ được công nhận sau khi contract probe và handshake live đạt yêu cầu.</p></div>
          </section>
        </> : null}
      </section>
    </main>
  );
}

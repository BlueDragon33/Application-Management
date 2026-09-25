"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  contractRegistryAction,
  type ContractRegistryApplication,
  type ContractRegistryResponse,
} from "../../admin-device-client";
import styles from "./contract-registry.module.css";

const classifications = [
  ["learning", "Học tập"],
  ["health", "Y tế"],
  ["academic", "Học thuật"],
  ["family", "Gia đình"],
  ["accounting", "Kế toán"],
  ["engineering", "Kỹ thuật"],
  ["infrastructure", "Hạ tầng"],
  ["operations", "Vận hành"],
  ["other", "Khác"],
] as const;

const stateLabel: Record<string, string> = {
  connected: "Đã kết nối",
  warning: "Có cảnh báo",
  pending: "Chờ contract",
  disabled: "Đã tắt",
};

function displayTime(value: string | null) {
  if (!value) return "Chưa probe";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function ContractRegistryPage() {
  const [applications, setApplications] = useState<ContractRegistryApplication[]>([]);
  const [controlOrigin, setControlOrigin] = useState("");
  const [manifestPath, setManifestPath] = useState("/.well-known/application-management.json");
  const [discovery, setDiscovery] = useState<ContractRegistryResponse["discovery"] | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState("");
  const [legacyControlOrigin, setLegacyControlOrigin] = useState("");
  const [legacyRuntimeOrigin, setLegacyRuntimeOrigin] = useState("");
  const [legacyClassification, setLegacyClassification] = useState("other");
  const [legacyCategory, setLegacyCategory] = useState("Khác");
  const [pairingId, setPairingId] = useState("");
  const [pairingCode, setPairingCode] = useState("");

  async function load() {
    setBusy("load");
    setError("");
    try {
      const result = await contractRegistryAction({ action: "bootstrap" });
      setApplications(result.applications ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không đọc được Contract Registry.");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => { void load(); }, []);

  const grouped = useMemo(() => {
    const groups = new Map<string, ContractRegistryApplication[]>();
    applications.forEach((app) => {
      const key = app.categoryLabel || "Khác";
      groups.set(key, [...(groups.get(key) ?? []), app]);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "vi"));
  }, [applications]);

  async function discover() {
    setBusy("discover");
    setError("");
    setNotice("");
    try {
      const result = await contractRegistryAction({
        action: "discover",
        controlOrigin,
        manifestPath,
      });
      if (!result.discovery) throw new Error("Client chưa trả manifest hợp lệ.");
      setDiscovery(result.discovery);
      setNotice("Manifest hợp lệ. Kiểm tra thông tin rồi lưu vào Trung tâm.");
    } catch (caught) {
      setDiscovery(null);
      setError(caught instanceof Error ? caught.message : "Không discovery được contract.");
    } finally {
      setBusy("");
    }
  }

  async function saveDiscovery() {
    setBusy("save");
    setError("");
    try {
      const result = await contractRegistryAction({
        action: "save-discovered",
        controlOrigin,
        manifestPath,
      });
      if (!result.application) throw new Error("Không lưu được ứng dụng.");
      setNotice(`Đã đưa ${result.application.shortName} vào diện quản trị.`);
      setDiscovery(null);
      setControlOrigin("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không lưu được contract.");
    } finally {
      setBusy("");
    }
  }

  async function probe(applicationId: string) {
    setBusy(`probe:${applicationId}`);
    setError("");
    try {
      const result = await contractRegistryAction({ action: "probe", applicationId });
      setNotice(result.application?.state === "connected"
        ? `${result.application.shortName}: contract đang hoạt động.`
        : `${result.application?.shortName ?? applicationId}: cần kiểm tra contract.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không probe được ứng dụng.");
    } finally {
      setBusy("");
    }
  }

  async function probeAll() {
    setBusy("probe-all");
    setError("");
    try {
      const result = await contractRegistryAction({ action: "probe-all" });
      setApplications(result.applications ?? []);
      setNotice("Đã kiểm tra lại toàn bộ contract.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không kiểm tra được toàn bộ contract.");
    } finally {
      setBusy("");
    }
  }

  function startLegacyEdit(app: ContractRegistryApplication) {
    setEditingId(app.applicationId);
    setLegacyControlOrigin(app.controlOrigin ?? "");
    setLegacyRuntimeOrigin(app.runtimeOrigin ?? "");
    setLegacyClassification(app.classification || "other");
    setLegacyCategory(app.categoryLabel || "Khác");
  }

  async function saveLegacy() {
    setBusy(`legacy:${editingId}`);
    setError("");
    try {
      await contractRegistryAction({
        action: "save-legacy",
        applicationId: editingId,
        controlOrigin: legacyControlOrigin,
        runtimeOrigin: legacyRuntimeOrigin,
        classification: legacyClassification,
        categoryLabel: legacyCategory,
      });
      setEditingId("");
      setNotice("Đã cập nhật origin/phân loại. Không cần redeploy Trung tâm.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không cập nhật được ứng dụng.");
    } finally {
      setBusy("");
    }
  }

  async function pair() {
    setBusy(`pair:${pairingId}`);
    setError("");
    try {
      const result = await contractRegistryAction({
        action: "pair",
        applicationId: pairingId,
        pairingCode,
      });
      setPairingCode("");
      setPairingId("");
      setNotice(result.application?.state === "connected"
        ? "Pairing thành công và contract đã kết nối."
        : "Pairing hoàn tất; cần kiểm tra lại trạng thái contract.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pairing thất bại.");
    } finally {
      setBusy("");
    }
  }

  async function toggle(app: ContractRegistryApplication) {
    setBusy(`toggle:${app.applicationId}`);
    setError("");
    try {
      await contractRegistryAction({
        action: "set-enabled",
        applicationId: app.applicationId,
        enabled: !app.enabled,
      });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không đổi được trạng thái.");
    } finally {
      setBusy("");
    }
  }

  async function remove(app: ContractRegistryApplication) {
    if (!window.confirm(`Xóa ${app.shortName} khỏi Contract Registry? Dữ liệu nghiệp vụ của client không bị xóa.`)) return;
    setBusy(`delete:${app.applicationId}`);
    setError("");
    try {
      await contractRegistryAction({ action: "delete", applicationId: app.applicationId });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không xóa được contract.");
    } finally {
      setBusy("");
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <small>OPEN CONTRACT REGISTRY V1</small>
            <h1>Ứng dụng & Contract</h1>
            <p>Thêm ứng dụng mới bằng manifest chuẩn, phân loại và pairing. Sau khi hệ thống này được triển khai, Trung tâm không cần thêm route riêng hoặc sửa danh sách ID chỉ để nhận một client mới.</p>
          </div>
          <div className={styles.heroActions}>
            <button onClick={() => void probeAll()} disabled={Boolean(busy)}>{busy === "probe-all" ? "Đang kiểm tra…" : "Kiểm tra tất cả"}</button>
            <Link href="/">← Trung tâm</Link>
          </div>
        </header>

        {error ? <div className={styles.error}><strong>Lỗi:</strong> {error}</div> : null}
        {notice ? <div className={styles.notice}>{notice}</div> : null}

        <section className={styles.addPanel}>
          <header>
            <div><small>THÊM ỨNG DỤNG</small><h2>Discovery từ manifest</h2></div>
            <span>Không nhập secret dài hạn tại đây</span>
          </header>
          <div className={styles.formGrid}>
            <label><span>Control origin</span><input value={controlOrigin} onChange={(e) => setControlOrigin(e.target.value)} placeholder="https://my-app.example.com"/></label>
            <label><span>Manifest path</span><input value={manifestPath} onChange={(e) => setManifestPath(e.target.value)} /></label>
          </div>
          <div className={styles.actions}>
            <button onClick={() => void discover()} disabled={busy === "discover" || !controlOrigin}>{busy === "discover" ? "Đang discovery…" : "Đọc manifest"}</button>
            {discovery ? <button className={styles.primary} onClick={() => void saveDiscovery()} disabled={busy === "save"}>{busy === "save" ? "Đang lưu…" : "Đưa vào quản trị"}</button> : null}
          </div>
          {discovery ? <article className={styles.discovery}>
            <div><strong>{String(discovery.manifest.application.name ?? discovery.manifest.application.id)}</strong><span>{discovery.manifest.protocol}</span></div>
            <p><b>ID:</b> {String(discovery.manifest.application.id)} · <b>Phân loại:</b> {String(discovery.manifest.application.categoryLabel ?? discovery.manifest.application.classification)}</p>
            <p><b>Auth:</b> {String(discovery.manifest.auth.mode)} · <b>Capabilities:</b> {Object.entries(discovery.manifest.capabilities).filter(([,v]) => v === true).map(([k]) => k).join(", ") || "Chưa công bố"}</p>
          </article> : null}
        </section>

        <section className={styles.registry}>
          <header><div><small>DANH SÁCH QUẢN TRỊ</small><h2>{applications.length} ứng dụng trong registry</h2></div><span>{busy === "load" ? "Đang đồng bộ…" : "D1 là nguồn cấu hình động"}</span></header>
          {grouped.map(([category, apps]) => <section className={styles.group} key={category}>
            <h3>{category}<b>{apps.length}</b></h3>
            <div className={styles.cards}>
              {apps.map((app) => <article className={styles.card} key={app.applicationId} data-state={app.state}>
                <header>
                  <div className={styles.logo}>{app.initials}</div>
                  <div><strong>{app.name}</strong><small>{app.applicationId}</small></div>
                  <span className={styles.state}>{stateLabel[app.state] ?? app.state}</span>
                </header>
                <dl>
                  <div><dt>Control</dt><dd>{app.controlOrigin ?? "Chưa cấu hình"}</dd></div>
                  <div><dt>Runtime</dt><dd>{app.runtimeOrigin ?? "Chưa công bố"}</dd></div>
                  <div><dt>Auth</dt><dd>{app.authMode}</dd></div>
                  <div><dt>Probe</dt><dd>{displayTime(app.lastProbeAt)}</dd></div>
                </dl>
                {app.lastError ? <p className={styles.cardError}>{app.lastError}</p> : null}
                <div className={styles.capabilities}>{Object.entries(app.capabilities).filter(([,v]) => v === true).slice(0, 6).map(([key]) => <span key={key}>{key}</span>)}</div>
                <footer>
                  <button onClick={() => void probe(app.applicationId)} disabled={busy === `probe:${app.applicationId}`}>↻ Probe</button>
                  {app.authMode === "paired-bearer" ? <button onClick={() => { setPairingId(app.applicationId); setPairingCode(""); }}>Pairing</button> : null}
                  {app.authMode === "legacy-env" ? <button onClick={() => startLegacyEdit(app)}>Origin</button> : null}
                  <button onClick={() => void toggle(app)}>{app.enabled ? "Tắt" : "Bật"}</button>
                  {app.authMode !== "legacy-env" ? <button className={styles.danger} onClick={() => void remove(app)}>Xóa</button> : null}
                </footer>
              </article>)}
            </div>
          </section>)}
        </section>

        {editingId ? <div className={styles.modalBackdrop}><section className={styles.modal}>
          <header><div><small>COMPATIBILITY APP</small><h2>Cập nhật origin không cần redeploy</h2></div><button onClick={() => setEditingId("")}>×</button></header>
          <label><span>Control origin</span><input value={legacyControlOrigin} onChange={(e) => setLegacyControlOrigin(e.target.value)} placeholder="https://control.example.com"/></label>
          <label><span>Runtime origin</span><input value={legacyRuntimeOrigin} onChange={(e) => setLegacyRuntimeOrigin(e.target.value)} placeholder="https://app.example.com"/></label>
          <div className={styles.formGrid}>
            <label><span>Phân loại</span><select value={legacyClassification} onChange={(e) => { setLegacyClassification(e.target.value); const found = classifications.find(([id]) => id === e.target.value); if (found) setLegacyCategory(found[1]); }}>{classifications.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            <label><span>Nhãn hiển thị</span><input value={legacyCategory} onChange={(e) => setLegacyCategory(e.target.value)}/></label>
          </div>
          <div className={styles.actions}><button onClick={() => setEditingId("")}>Hủy</button><button className={styles.primary} onClick={() => void saveLegacy()}>Lưu cấu hình</button></div>
        </section></div> : null}

        {pairingId ? <div className={styles.modalBackdrop}><section className={styles.modal}>
          <header><div><small>PAIRING</small><h2>Kết nối client mới</h2></div><button onClick={() => setPairingId("")}>×</button></header>
          <p>Nhập pairing code một lần do chính client sinh. Trung tâm đổi code lấy access token rồi mã hóa token trong D1.</p>
          <label><span>Pairing code</span><input type="password" autoComplete="off" value={pairingCode} onChange={(e) => setPairingCode(e.target.value)}/></label>
          <div className={styles.actions}><button onClick={() => setPairingId("")}>Hủy</button><button className={styles.primary} onClick={() => void pair()} disabled={pairingCode.length < 6}>Pair & Probe</button></div>
        </section></div> : null}
      </section>
    </main>
  );
}

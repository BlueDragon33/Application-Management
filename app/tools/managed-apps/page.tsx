"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { managedAppsAction } from "../../admin-device-client";

type CatalogApp = {
  id: string;
  name: string;
  shortName: string;
  category: string;
  origin: string;
  publicUrl: string | null;
  repository: string | null;
  contractPath: string;
  enabled: boolean;
  credentialConfigured: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProbeSummary = {
  id?: string;
  name?: string;
  connection?: string;
  credentialConfigured?: boolean;
  contractConnected?: boolean;
  remoteAdminReady?: boolean;
  managementMode?: "remote-admin" | "observe-only" | "local-first" | "metadata-only";
  metadataVerified?: boolean;
  note?: string;
  protocol?: string | null;
  discoveredVia?: string | null;
  capabilities?: string[];
  deviceCount?: number;
};

type DiscoveryDraft = {
  id: string;
  name: string;
  shortName: string;
  category: string | null;
  categoryRequired: boolean;
  origin: string;
  publicUrl: string;
  repository: string | null;
  contractPath: string;
  protocol: string;
  version: string | null;
  discoveredVia: string;
  credentialRequired: boolean;
  capabilities: string[];
};

type CatalogResponse = {
  ok?: boolean;
  error?: string;
  discovery?: DiscoveryDraft;
  encryptionReady?: boolean;
  apps?: CatalogApp[];
  migrated?: Array<{ id: string; source?: string; probe?: ProbeSummary | null }>;
  existing?: Array<{ id: string; probe?: ProbeSummary | null }>;
  needsOrigin?: Array<{ id: string; name: string; category: string; repository?: string; reason: string }>;
  probes?: ProbeSummary[];
  totals?: {
    migrated?: number;
    existing?: number;
    needsOrigin?: number;
    connected?: number;
    warning?: number;
    pending?: number;
    localFirst?: number;
    metadataOnly?: number;
    unavailable?: number;
  };
  template?: Record<string, unknown>;
  profile?: {
    recommendedContractCapabilities?: string[];
    defaultGuardrails?: string[];
  };
  probe?: ProbeSummary;
};

const categories = ["Học tập", "Y tế", "Nga", "Học thuật", "Gia đình", "Kế toán", "Kỹ thuật"] as const;

const emptyForm = {
  id: "",
  name: "",
  shortName: "",
  category: "Học tập",
  origin: "",
  publicUrl: "",
  repository: "",
  contractPath: "/api/application-management/contract",
  credential: "",
};

export default function ManagedAppsCatalogPage() {
  const [apps, setApps] = useState<CatalogApp[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [probe, setProbe] = useState<CatalogResponse["probe"] | null>(null);
  const [starter, setStarter] = useState<{ template: Record<string, unknown>; recommended: string[]; guardrails: string[] } | null>(null);
  const [syncResult, setSyncResult] = useState<CatalogResponse | null>(null);
  const [discoveryTarget, setDiscoveryTarget] = useState("");
  const [discovery, setDiscovery] = useState<DiscoveryDraft | null>(null);

  async function load() {
    setBusy("load");
    setMessage("");
    try {
      const result = await managedAppsAction({ action: "list" }) as CatalogResponse;
      setApps(result.apps ?? []);
      setEncryptionReady(Boolean(result.encryptionReady));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không đọc được catalog.");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => { void load(); }, []);

  const editing = useMemo(() => apps.find((item) => item.id === form.id), [apps, form.id]);

  function edit(app: CatalogApp) {
    setForm({
      id: app.id,
      name: app.name,
      shortName: app.shortName,
      category: app.category,
      origin: app.origin,
      publicUrl: app.publicUrl ?? "",
      repository: app.repository ?? "",
      contractPath: app.contractPath,
      credential: "",
    });
    setProbe(null);
    setStarter(null);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function discoverFromUrl() {
    setBusy("discover");
    setMessage("");
    setProbe(null);
    setStarter(null);
    setDiscovery(null);
    try {
      const result = await managedAppsAction({
        action: "discover",
        target: discoveryTarget,
        credential: form.credential,
      }) as CatalogResponse;
      if (!result.discovery) throw new Error("Không đọc được contract từ URL.");
      const draft = result.discovery;
      setDiscovery(draft);
      setForm((current) => ({
        ...current,
        id: draft.id,
        name: draft.name,
        shortName: draft.shortName || draft.name,
        category: draft.category ?? current.category,
        origin: draft.origin,
        publicUrl: draft.publicUrl || current.publicUrl,
        repository: draft.repository ?? current.repository,
        contractPath: draft.contractPath,
      }));
      setMessage(draft.categoryRequired
        ? `Đã phát hiện ${draft.name}. Contract chưa khai báo category; hãy chọn đúng phân loại rồi lưu.`
        : `Đã phát hiện ${draft.name} · ${draft.category} · ${draft.protocol}. Kiểm tra lại và bấm Lưu & kiểm tra contract.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể khám phá contract từ URL.");
    } finally {
      setBusy("");
    }
  }

  async function save() {
    setBusy("save");
    setMessage("");
    setProbe(null);
    try {
      const result = await managedAppsAction({ action: "upsert", ...form }) as CatalogResponse;
      setProbe(result.probe ?? null);
      setMessage(result.probe?.managementMode === "local-first" && result.probe?.metadataVerified
        ? "Đã lưu và xác minh metadata local-first. Ứng dụng không yêu cầu Remote Admin cloud."
        : result.probe?.managementMode === "metadata-only" && result.probe?.metadataVerified
          ? "Đã lưu và xác minh metadata. Runtime Production chưa được công bố nên không tạo cảnh báo mất kết nối."
          : result.probe?.remoteAdminReady
            ? "Đã lưu và Universal Contract sẵn sàng quản trị."
            : result.probe?.contractConnected
              ? "Đã lưu và đã nối Universal Contract. Hiện ứng dụng ở chế độ chỉ quan sát cho tới khi credential/capability quản trị đầy đủ."
              : "Đã lưu catalog nhưng chưa bắt tay được Universal Contract. Hệ thống tiếp tục khóa thao tác từ xa cho tới khi contract hợp lệ.");
      setForm((current) => ({ ...current, credential: "" }));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể lưu ứng dụng.");
    } finally {
      setBusy("");
    }
  }

  async function generateStarter() {
    setBusy("template");
    setMessage("");
    try {
      const result = await managedAppsAction({
        action: "template",
        id: form.id,
        name: form.name,
        category: form.category,
      }) as CatalogResponse;
      if (!result.template) throw new Error("Không tạo được contract starter.");
      setStarter({
        template: result.template,
        recommended: result.profile?.recommendedContractCapabilities ?? [],
        guardrails: result.profile?.defaultGuardrails ?? [],
      });
      setMessage("Đã sinh contract starter theo phân loại. Chỉ bật capability sau khi endpoint thật đã triển khai.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tạo contract starter.");
    } finally {
      setBusy("");
    }
  }

  async function probeApp(id: string) {
    setBusy(`probe:${id}`);
    setMessage("");
    try {
      const result = await managedAppsAction({ action: "probe", id }) as CatalogResponse;
      setProbe(result.probe ?? null);
      setMessage(result.probe?.note ?? "Đã kiểm tra contract.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể kiểm tra contract.");
    } finally {
      setBusy("");
    }
  }

  async function syncExisting() {
    setBusy("sync-existing");
    setMessage("");
    setProbe(null);
    setSyncResult(null);
    try {
      const result = await managedAppsAction({ action: "sync-existing" }) as CatalogResponse;
      setSyncResult(result);
      const migrated = result.totals?.migrated ?? 0;
      const existing = result.totals?.existing ?? 0;
      const needsOrigin = result.totals?.needsOrigin ?? 0;
      setMessage(`Đã đồng bộ: ${migrated} app mới vào Catalog, ${existing} app đã có, ${needsOrigin} app cần khai báo Control Origin.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể đồng bộ ứng dụng hiện có.");
    } finally {
      setBusy("");
    }
  }

  async function probeAll() {
    setBusy("probe-all");
    setMessage("");
    setProbe(null);
    setSyncResult(null);
    try {
      const result = await managedAppsAction({ action: "probe-all" }) as CatalogResponse;
      setSyncResult(result);
      const connected = result.totals?.connected ?? 0;
      const warning = result.totals?.warning ?? 0;
      const pending = result.totals?.pending ?? 0;
      const localFirst = result.totals?.localFirst ?? 0;
      const metadataOnly = result.totals?.metadataOnly ?? 0;
      const unavailable = result.totals?.unavailable ?? 0;
      setMessage(`Đã kiểm tra toàn bộ contract: ${connected} sẵn sàng quản trị · ${warning} đã nối contract/chỉ quan sát · ${localFirst} local-first · ${metadataOnly} metadata-only · ${pending} thực sự chờ contract · ${unavailable} không khả dụng.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể kiểm tra toàn bộ contract.");
    } finally {
      setBusy("");
    }
  }

  async function remove(id: string) {
    if (!window.confirm(`Loại ${id} khỏi catalog quản trị? Dữ liệu nghiệp vụ của client không bị xóa.`)) return;
    setBusy(`remove:${id}`);
    try {
      await managedAppsAction({ action: "remove", id });
      if (form.id === id) setForm(emptyForm);
      setProbe(null);
      setMessage("Đã loại ứng dụng khỏi catalog.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể loại ứng dụng.");
    } finally {
      setBusy("");
    }
  }

  return <main style={{ minHeight: "100vh", background: "#071b15", color: "#edfdf7", padding: "24px", fontFamily: "Inter, Arial, sans-serif" }}>
    <section style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
        <div>
          <small style={{ color: "#65d9ba", fontWeight: 900, letterSpacing: ".08em" }}>OPEN CONTRACT CATALOG</small>
          <h1 style={{ margin: "6px 0 8px", fontSize: 30 }}>Ứng dụng & Universal Contract</h1>
          <p style={{ margin: 0, color: "#a9c9bd", maxWidth: 850, lineHeight: 1.55 }}>
            Thêm ứng dụng mới bằng cấu hình, không sửa code Trung tâm. Client công bố <code>application-management.contract/v1</code>; capability và endpoint được tự khám phá.
          </p>
        </div>
        <Link href="/" style={linkStyle}>← Trung tâm</Link>
      </header>

      <div style={{ padding: 14, borderRadius: 12, marginBottom: 18, border: `1px solid ${encryptionReady ? "#2d725e" : "#7d6332"}`, background: encryptionReady ? "#0e3025" : "#332812" }}>
        <strong>{encryptionReady ? "✓ Mã hóa credential sẵn sàng" : "⚠ Chưa có khóa mã hóa credential"}</strong>
        <p style={{ margin: "6px 0 0", color: "#c9ddd5", lineHeight: 1.5 }}>
          {encryptionReady
            ? "Token app được mã hóa AES-GCM trước khi lưu D1. Có thể thêm/đổi credential trực tiếp tại đây."
            : "Có thể thêm app và probe manifest ngay. Khi deploy Cloudflare, hệ thống sẽ tự tạo khóa mã hóa credential một lần nếu Worker chưa có."}
        </p>
      </div>

      <section style={{ ...panelStyle, marginBottom: 16, borderColor: "#2c6754" }}>
        <small style={eyebrow}>ZERO-CODE ONBOARDING</small>
        <h2 style={h2}>Khám phá app từ URL</h2>
        <p style={{ color: "#b9d5cb", lineHeight: 1.5, margin: "8px 0 12px" }}>
          Dán Control Origin, runtime URL, GitHub Pages subpath hoặc URL manifest. Trung tâm tự thử các contract path chuẩn và điền ID, tên, phân loại, protocol, capability. Không cần sửa source Trung tâm.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "end" }}>
          <Field label="URL app / control / manifest">
            <input style={inputStyle} value={discoveryTarget} onChange={(e) => setDiscoveryTarget(e.target.value)} placeholder="https://app.example.com hoặc .../management-contract.json"/>
          </Field>
          <button style={primaryButton} disabled={Boolean(busy) || !discoveryTarget.trim()} onClick={() => void discoverFromUrl()}>
            {busy === "discover" ? "Đang khám phá…" : "Khám phá contract"}
          </button>
        </div>
        <small style={{ display: "block", marginTop: 9, color: "#86aa9d" }}>
          Nếu endpoint cần Bearer token, nhập token ở ô Credential bên dưới trước khi khám phá. Token chỉ được lưu khi Owner bấm Lưu.
        </small>
      </section>

      <section style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div><small style={eyebrow}>CATALOG ENTRY</small><h2 style={h2}>{editing ? `Sửa ${editing.shortName}` : "Thêm ứng dụng mới"}</h2></div>
          {editing ? <button style={secondaryButton} onClick={() => { setForm(emptyForm); setProbe(null); }}>Tạo mới</button> : null}
        </div>
        <div style={gridStyle}>
          <Field label="ID / slug"><input style={inputStyle} value={form.id} disabled={Boolean(editing)} onChange={(e) => setForm({ ...form, id: e.target.value.toLowerCase() })} placeholder="my-new-app"/></Field>
          <Field label="Phân loại"><select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Tên ứng dụng"><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tên đầy đủ"/></Field>
          <Field label="Tên ngắn"><input style={inputStyle} value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} placeholder="Tên hiển thị"/></Field>
          <Field label="Control origin"><input style={inputStyle} value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} placeholder="https://app.example.com"/></Field>
          <Field label="Website sử dụng"><input style={inputStyle} value={form.publicUrl} onChange={(e) => setForm({ ...form, publicUrl: e.target.value })} placeholder="https://app.example.com/"/></Field>
          <Field label="Repository"><input style={inputStyle} value={form.repository} onChange={(e) => setForm({ ...form, repository: e.target.value })} placeholder="owner/repo"/></Field>
          <Field label="Contract path"><input style={inputStyle} value={form.contractPath} onChange={(e) => setForm({ ...form, contractPath: e.target.value })}/></Field>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label={editing?.credentialConfigured ? "Credential quản trị · để trống để giữ credential cũ" : "Credential quản trị · tùy chọn"}>
              <input type="password" autoComplete="new-password" style={inputStyle} value={form.credential} onChange={(e) => setForm({ ...form, credential: e.target.value })} placeholder={encryptionReady ? "Bearer token do client cấp" : "Cấu hình khóa mã hóa trước khi lưu token"}/>
            </Field>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button style={primaryButton} disabled={Boolean(busy) || !form.id || !form.name || !form.origin} onClick={() => void save()}>{busy === "save" ? "Đang lưu…" : "Lưu & kiểm tra contract"}</button>
          <button style={secondaryButton} disabled={Boolean(busy) || !form.id || !form.name} onClick={() => void generateStarter()}>{busy === "template" ? "Đang tạo…" : "Tạo contract mẫu theo phân loại"}</button>
          <button style={secondaryButton} disabled={Boolean(busy)} onClick={() => void syncExisting()}>{busy === "sync-existing" ? "Đang đồng bộ…" : "Đồng bộ ứng dụng hiện có"}</button>
          <button style={secondaryButton} disabled={Boolean(busy)} onClick={() => void probeAll()}>{busy === "probe-all" ? "Đang kiểm tra…" : "Kiểm tra lại tất cả contract"}</button>
          <Link href="/tools/contract-diagnostics" style={linkStyle}>Mở chẩn đoán hệ thống</Link>
          <Link href="/tools/secret-generator" style={linkStyle}>Tạo Key / Secret</Link>
        </div>
      </section>

      {message ? <div style={{ margin: "16px 0", padding: 14, borderRadius: 12, background: "#0d2a20", border: "1px solid #245443", lineHeight: 1.5 }}>{message}</div> : null}

      {discovery ? <section style={{ ...panelStyle, marginBottom: 16 }}>
        <small style={eyebrow}>DISCOVERY RESULT</small>
        <h2 style={h2}>{discovery.name}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginTop: 12 }}>
          <Stat label="ID" value={discovery.id}/>
          <Stat label="Phân loại" value={discovery.category ?? "Cần Owner chọn"}/>
          <Stat label="Protocol" value={discovery.protocol}/>
          <Stat label="Discovery path" value={discovery.discoveredVia}/>
          <Stat label="Credential" value={discovery.credentialRequired ? "Cần credential để đọc" : "Manifest công khai"}/>
          <Stat label="Version" value={discovery.version ?? "—"}/>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {discovery.capabilities.length
            ? discovery.capabilities.map((item) => <span key={item} style={chipStyle}>{item}</span>)
            : <span style={{ color: "#9bbcaf" }}>Contract chưa công bố capability bật.</span>}
        </div>
      </section> : null}

      {syncResult?.needsOrigin?.length ? <section style={{ ...panelStyle, marginBottom: 16, borderColor: "#765d2c" }}>
        <small style={{ ...eyebrow, color: "#f1c86f" }}>CẦN CONTROL ORIGIN</small>
        <h2 style={h2}>{syncResult.needsOrigin.length} ứng dụng chưa thể tự nối contract</h2>
        <p style={{ color: "#c9ddd5", lineHeight: 1.5 }}>
          Đây không phải lỗi code Trung tâm. Client chưa có Production Control Origin đã biết. Chọn app, nhập origin/credential một lần trong Catalog; từ các lần sau hệ thống tự discovery và re-probe.
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          {syncResult.needsOrigin.map((item) => <article key={item.id} style={{ border: "1px solid #5f4e2d", borderRadius: 10, padding: 12, background: "#261f10" }}>
            <strong>{item.name}</strong>
            <small style={{ display: "block", color: "#cfb979", marginTop: 4 }}>{item.id} · {item.category}{item.repository ? ` · ${item.repository}` : ""}</small>
            <span style={{ display: "block", marginTop: 6, color: "#ead9ab" }}>{item.reason}</span>
          </article>)}
        </div>
      </section> : null}

      {syncResult?.probes?.length ? <section style={{ ...panelStyle, marginBottom: 16 }}>
        <small style={eyebrow}>BATCH CONTRACT PROBE</small>
        <h2 style={h2}>Trạng thái contract động</h2>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {syncResult.probes.map((item) => <article key={item?.id ?? item?.name} style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) 110px minmax(260px,2fr)", gap: 10, border: "1px solid #214b3d", borderRadius: 10, padding: 11 }}>
            <strong>{item?.name ?? item?.id}</strong>
            <b style={{ color: item?.connection === "connected" ? "#72ddb9" : item?.connection === "warning" ? "#f1c86f" : "#e59b9b" }}>{connectionLabel(item)}</b>
            <span style={{ color: "#a9c9bd" }}>{item?.note ?? "—"}</span>
          </article>)}
        </div>
      </section> : null}

      {starter ? <section style={panelStyle}>
        <small style={eyebrow}>CATEGORY CONTRACT STARTER</small>
        <h2 style={h2}>Khung contract cho {form.category}</h2>
        <p style={{ color: "#b9d5cb", lineHeight: 1.5 }}>
          Capability trong mẫu mặc định đều <strong>false</strong>. App chỉ đổi sang <strong>true</strong> khi endpoint tương ứng đã hoạt động thật.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(240px,.8fr)", gap: 14, alignItems: "start" }}>
          <pre style={{ margin: 0, padding: 14, borderRadius: 10, background: "#061710", border: "1px solid #214b3d", overflow: "auto", maxHeight: 520, color: "#d8fff1", fontSize: 12, lineHeight: 1.5 }}>{JSON.stringify(starter.template, null, 2)}</pre>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <strong>Capability gợi ý theo loại</strong>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 8 }}>{starter.recommended.map((item) => <span key={item} style={chipStyle}>{item}</span>)}</div>
            </div>
            <div>
              <strong>Guardrail bắt buộc</strong>
              <ul style={{ color: "#b9d5cb", paddingLeft: 18, lineHeight: 1.55 }}>{starter.guardrails.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </div>
        </div>
      </section> : null}

      {probe ? <section style={panelStyle}>
        <small style={eyebrow}>LIVE CONTRACT PROBE</small>
        <h2 style={h2}>{probe.name ?? probe.id ?? "Contract"}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
          <Stat label="Trạng thái" value={connectionLabel(probe)}/>
          <Stat label="Contract" value={probe.metadataVerified ? "Metadata đã xác minh" : probe.contractConnected ? "Đã bắt tay" : "Chưa bắt tay"}/>
          <Stat label="Credential" value={probe.credentialConfigured ? "Đã cấu hình" : "Chưa cấu hình"}/>
          <Stat label="Remote admin" value={probe.managementMode === "local-first" || probe.managementMode === "metadata-only" ? "Không yêu cầu" : probe.remoteAdminReady ? "Sẵn sàng" : "Fail-closed"}/>
          <Stat label="Protocol" value={probe.protocol ?? "—"}/>
          <Stat label="Discovery" value={probe.discoveredVia ?? "—"}/>
          <Stat label="Thiết bị đọc được" value={String(probe.deviceCount ?? 0)}/>
        </div>
        <p style={{ color: "#b9d5cb" }}>{probe.note}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{(probe.capabilities ?? []).map((item) => <span key={item} style={chipStyle}>{item}</span>)}</div>
      </section> : null}

      <section style={{ ...panelStyle, marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div><small style={eyebrow}>DYNAMIC CATALOG</small><h2 style={h2}>{apps.length} ứng dụng cấu hình động</h2></div>
          <button style={secondaryButton} onClick={() => void load()} disabled={busy === "load"}>{busy === "load" ? "Đang tải…" : "↻ Làm mới"}</button>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {apps.map((app) => <article key={app.id} style={{ border: "1px solid #214b3d", borderRadius: 12, padding: 14, background: "#0a241b", display: "grid", gridTemplateColumns: "minmax(180px,1.2fr) minmax(150px,.7fr) minmax(240px,1.4fr) auto", gap: 12, alignItems: "center" }}>
            <div><strong>{app.name}</strong><small style={{ display: "block", color: "#7fa99a", marginTop: 4 }}>{app.id} · {app.category}</small></div>
            <div><small style={{ color: "#8fb4a7" }}>Credential</small><strong style={{ display: "block", color: app.credentialConfigured ? "#72ddb9" : "#f1c86f" }}>{app.credentialConfigured ? "Đã mã hóa" : "Chưa có"}</strong></div>
            <code style={{ color: "#c8eadf", overflowWrap: "anywhere" }}>{app.origin}{app.contractPath}</code>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button style={secondaryButton} onClick={() => void probeApp(app.id)} disabled={busy === `probe:${app.id}`}>Probe</button>
              <button style={secondaryButton} onClick={() => edit(app)}>Sửa</button>
              <button style={dangerButton} onClick={() => void remove(app.id)} disabled={busy === `remove:${app.id}`}>Loại</button>
            </div>
          </article>)}
          {!apps.length ? <p style={{ color: "#9bbcaf" }}>Chưa có app động. Các app legacy hiện tại vẫn tiếp tục hoạt động qua adapter riêng.</p> : null}
        </div>
      </section>
    </section>
  </main>;
}

function connectionLabel(item: ProbeSummary | null | undefined) {
  if (!item) return "—";
  if (item.managementMode === "local-first" && item.metadataVerified) return "Local-first · metadata đã xác minh";
  if (item.managementMode === "metadata-only" && item.metadataVerified) return "Metadata đã xác minh · chưa có runtime";
  if (item.remoteAdminReady) return "Sẵn sàng quản trị";
  if (item.contractConnected) return "Đã nối contract · chỉ quan sát";
  if (item.connection === "pending") return "Chờ contract";
  if (item.connection === "unavailable") return "Không khả dụng";
  if (item.connection === "warning") return "Cần cấu hình";
  if (item.connection === "connected") return "Đã kết nối";
  return "Chưa xác định";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "grid", gap: 6 }}><span style={{ color: "#9fc2b5", fontSize: 12, fontWeight: 800 }}>{label}</span>{children}</label>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div style={{ background: "#081d16", border: "1px solid #1e493a", borderRadius: 10, padding: 12 }}><small style={{ color: "#89ad9f" }}>{label}</small><strong style={{ display: "block", marginTop: 4 }}>{value}</strong></div>;
}
const panelStyle = { background: "#0d2a20", border: "1px solid #20483a", borderRadius: 14, padding: 18 } as const;
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 } as const;
const inputStyle = { width: "100%", boxSizing: "border-box", borderRadius: 9, border: "1px solid #315f50", background: "#071b15", color: "#eefdf8", padding: "10px 11px", outline: "none" } as const;
const primaryButton = { border: 0, borderRadius: 9, background: "#14785f", color: "#fff", padding: "10px 14px", fontWeight: 800, cursor: "pointer" } as const;
const secondaryButton = { border: "1px solid #315f50", borderRadius: 9, background: "#102e24", color: "#e9fff7", padding: "9px 12px", fontWeight: 700, cursor: "pointer" } as const;
const dangerButton = { ...secondaryButton, border: "1px solid #784747", color: "#ffcaca" } as const;
const linkStyle = { color: "#eafff7", textDecoration: "none", padding: "9px 12px", border: "1px solid #315f50", borderRadius: 9, fontSize: 13, fontWeight: 700 } as const;
const eyebrow = { color: "#65d9ba", fontWeight: 900, letterSpacing: ".08em", fontSize: 11 } as const;
const h2 = { margin: "4px 0 0", fontSize: 20 } as const;
const chipStyle = { padding: "6px 9px", borderRadius: 999, background: "#12382b", border: "1px solid #2c6754", color: "#c9f5e6", fontSize: 12, fontWeight: 700 } as const;

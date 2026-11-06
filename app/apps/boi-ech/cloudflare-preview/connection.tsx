"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminApiError, cloudflarePreviewAdminAction } from "../../../admin-device-client";
import AuthenticatorStepUp from "../../../authenticator-step-up";
import type { CloudflarePreviewState } from "../../../cloudflare-preview.server";
import styles from "./connection.module.css";

function thirtyDays() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 30 * 86400000));
}
function display(value?: string) {
  if (!value) return "Chưa xác minh";
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Europe/Moscow", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
type Reply = { ok?: boolean; state?: CloudflarePreviewState; error?: string };

export default function CloudflarePreviewConnection() {
  const [model, setModel] = useState<CloudflarePreviewState | null>(null);
  const [token, setToken] = useState("");
  const [lifecycle, setLifecycle] = useState("");
  const [expiry, setExpiry] = useState(thirtyDays);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsSync, setNeedsSync] = useState(false);
  const [authenticate, setAuthenticate] = useState(false);
  const lock = useRef(false);
  const authResolve = useRef<((verified: boolean) => void) | null>(null);

  const run = useCallback(async (body: Record<string, unknown>) => {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      let reply: Reply;
      try { reply = await cloudflarePreviewAdminAction(body) as Reply; }
      catch (caught) {
        if (!(caught instanceof AdminApiError) || caught.data.code !== "STEP_UP_REQUIRED") throw caught;
        setAuthenticate(true);
        const allowed = await new Promise<boolean>(resolve => { authResolve.current = resolve; });
        if (!allowed) throw new Error("Đã hủy xác minh; bản nháp được giữ nguyên.");
        reply = await cloudflarePreviewAdminAction(body) as Reply;
      }
      if (!reply.ok || !reply.state) throw new Error(reply.error || "Chưa đọc được trạng thái kết nối.");
      setModel(reply.state); setNeedsSync(false);
      if (body.action !== "status") setNotice(reply.state.revoked ? "Đã thu hồi token và xác minh kết quả." : body.action === "disconnect" ? "Đã ngắt kết nối và xóa token khỏi Vault App-Management." : reply.state.verified ? "Đã lưu và xác minh ngày hết hạn từ Cloudflare." : "Đã lưu kết nối. Trạng thái và các quyền khả dụng hiển thị bên dưới.");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể cập nhật kết nối.");
      setNeedsSync(true);
      return false;
    } finally { lock.current = false; setBusy(false); }
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) void run({ action: "status" }); });
    return () => { active = false; };
  }, [run]);
  useEffect(() => () => { authResolve.current?.(false); }, []);

  const canSave = Boolean(model?.encryptionReady) && !busy;
  const canManage = Boolean(model?.lifecycle.ready && model.deployment.scopeVerified) && !needsSync && !busy;
  function finishAuthentication(verified: boolean) { setAuthenticate(false); authResolve.current?.(verified); authResolve.current = null; }

  return <>
    <main className={styles.shell} inert={authenticate} aria-hidden={authenticate || undefined}>
      <header><Link href="/apps/boi-ech">← Quản trị Bơi ếch</Link><span>APPLICATION MANAGEMENT · OWNER</span><h1>Kết nối Cloudflare Preview</h1><p>Quản lý thời hạn và thu hồi token của Worker <strong>boi-ech-preview</strong> bằng giao diện.</p></header>
      <section className={styles.status} aria-label="Trạng thái Cloudflare Preview">
        <div><strong>{model?.deployment.connected ? "Đã kết nối token" : "Chưa kết nối"}</strong><p role="status">{model?.blocker ? `BLOCKED · ${model.blocker}` : model ? "Quyền quản lý token đã được xác minh." : "Đang đọc trạng thái…"}</p><p>Hết hạn thực tế: <b>{display(model?.deployment.expiresOn)}</b> · giờ Moscow</p></div>
        <button onClick={() => void run({ action: "status" })} disabled={busy}>Đồng bộ trạng thái</button>
      </section>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      {notice ? <p className={styles.notice}>{notice}</p> : null}
      <div className={styles.grid}>
        <section className={styles.card}><h2>Token triển khai Preview</h2><p>Kết nối quyền quản lý token trước để xác minh đúng phạm vi. Chỉ lưu token Editor của đúng Worker boi-ech-preview, có ngày hết hạn. Token được mã hóa trong Vault và không hiển thị lại.</p>
          <form id="preview-connect-form" onSubmit={async event => { event.preventDefault(); if (await run({ action: "connect", credential: token })) setToken(""); }}>
            <label htmlFor="preview-deploy-token">Token Preview<input id="preview-deploy-token" type="password" autoComplete="off" spellCheck={false} value={token} onInput={event => setToken(event.currentTarget.value)} disabled={busy} required /></label>
            <button disabled={!canSave || !model?.lifecycle.configured || !token.trim()}>Kết nối token Preview</button>
          </form>
        </section>
        <section className={styles.card}><h2>Quyền đổi hạn và thu hồi</h2><p>Cần token riêng đã được Cloudflare cấp quyền <b>Account API Tokens Write</b>. App-Management chỉ quản lý token Preview đã xác minh đúng phạm vi. Việc cấp quyền mới cần Owner phê duyệt.</p>
          <form onSubmit={async event => { event.preventDefault(); if (await run({ action: "connect-lifecycle", credential: lifecycle })) setLifecycle(""); }}>
            <label htmlFor="preview-lifecycle-token">Token quản lý thời hạn<input id="preview-lifecycle-token" type="password" autoComplete="off" spellCheck={false} value={lifecycle} onInput={event => setLifecycle(event.currentTarget.value)} disabled={busy} required /></label>
            <button disabled={!canSave || !lifecycle.trim()}>Kết nối quyền quản lý token</button>
          </form>
        </section>
        <section className={styles.card}><h2>Thời hạn kết nối</h2><p>Chọn ngày hết hạn mới. Mọi thay đổi đều đọc lại từ Cloudflare để xác minh.</p>
          <form onSubmit={event => { event.preventDefault(); void run({ action: "update-expiry", expiresOn: new Date(`${expiry}T23:59:59+03:00`).toISOString(), expectedExpiresOn: model?.deployment.expiresOn }); }}>
            <label htmlFor="preview-expiry">Ngày hết hạn · 23:59 giờ Moscow<input id="preview-expiry" type="date" value={expiry} onInput={event => setExpiry(event.currentTarget.value)} disabled={busy} required /></label>
            <div className={styles.actions}><button type="button" disabled={busy} onClick={() => setExpiry(thirtyDays())}>30 ngày từ hôm nay</button><button disabled={!canManage || !expiry}>Lưu ngày hết hạn</button></div>
          </form>
        </section>
        <section className={styles.card}><h2>Quyền cán bộ quản lý</h2><p>Trong màn hình Thiết bị & tiến độ, chọn cán bộ → Ngày hết hạn → Lưu hồ sơ & thời hạn. Owner cấp hoặc thu hồi quyền điều phối ở chính hồ sơ đó.</p><p>Thời hạn manager thuộc tài khoản Bơi ếch, được quản lý riêng với token Cloudflare. Quyền admin của Trung tâm vẫn tách biệt.</p><Link href="/apps/boi-ech">Quản lý thời hạn và quyền manager</Link></section>
      </div>
      <section className={styles.card}><h2>Thu hồi token Preview</h2><p>Token bị thu hồi sẽ dừng triển khai bằng credential này. Nhập đúng tên <strong>{model?.deployment.tokenName || "token đã được xác minh"}</strong> để xác nhận.</p>
        <form onSubmit={event => { event.preventDefault(); void run({ action: "revoke", confirmation, expectedExpiresOn: model?.deployment.expiresOn }); }}>
          <label htmlFor="preview-revoke-name">Tên token cần thu hồi<input id="preview-revoke-name" value={confirmation} onInput={event => setConfirmation(event.currentTarget.value)} disabled={busy} autoComplete="off" /></label><button className={styles.danger} disabled={!canManage || confirmation !== model?.deployment.tokenName}>Thu hồi token Preview</button>
        </form>
        <p><button type="button" disabled={busy || !model || !model.vaultPresent && !model.deployment.connected && !model.lifecycle.configured} onClick={() => { if (window.confirm("Ngắt kết nối và xóa hai token đã mã hóa khỏi Vault App-Management? Token tại Cloudflare vẫn do Owner quản lý.")) void run({ action: "disconnect" }); }}>Ngắt kết nối App-Management</button></p>
      </section>
    </main>
    {authenticate ? <AuthenticatorStepUp finish={finishAuthentication} /> : null}
  </>;
}

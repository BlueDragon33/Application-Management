"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import styles from "./authenticator-step-up.module.css";

export default function AuthenticatorStepUp({ finish }: { finish: (verified: boolean) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const input = useRef<HTMLInputElement | null>(null);
  const dialog = useRef<HTMLElement | null>(null);
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; abort.current?.abort(); };
  }, []);

  useEffect(() => {
    // Disabling the focused control can otherwise move focus to the page body.
    if (busy) dialog.current?.focus();
    else input.current?.focus();
  }, [busy]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    if (!/^\d{6}$/.test(code)) { setError("Nhập đủ mã Authenticator gồm 6 số."); return; }
    lock.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    abort.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch("/__account/mfa/step-up", {
        method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
        headers: { Accept: "application/json" },
        body: new URLSearchParams({ code }), signal: controller.signal,
      });
      if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Không xác minh được phiên hiện tại. Bản nháp vẫn được giữ; hãy thử lại.");
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || result.ok !== true) throw new Error(result.error || "Không xác minh được phiên hiện tại. Hãy kiểm tra đăng nhập và thử lại.");
      if (mounted.current) finish(true);
    } catch (caught) {
      if (mounted.current) setError(controller.signal.aborted ? "Xác minh quá thời gian. Hãy thử lại; thay đổi chưa được lưu." : caught instanceof Error ? caught.message : "Không thể xác minh. Hãy thử lại.");
    } finally {
      window.clearTimeout(timer);
      lock.current = false;
      if (mounted.current) { setBusy(false); setCode(""); }
    }
  }

  function keyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") { event.preventDefault(); if (!lock.current) finish(false); return; }
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("input:not([disabled]),button:not([disabled])")];
    const first = controls[0]; const last = controls.at(-1);
    if (!first) { event.preventDefault(); event.currentTarget.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return <div className={styles.scrim}>
    <section ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-busy={busy} aria-label="Xác minh Authenticator" tabIndex={-1} onKeyDown={keyDown}>
      <h2>Xác minh thay đổi</h2>
      <p>Nhập mã 6 số từ Authenticator. Xác minh đúng sẽ tiếp tục lưu các thay đổi đang chờ.</p>
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor="policy-authenticator-code">Mã Authenticator</label>
        <input ref={input} id="policy-authenticator-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onInput={(event) => setCode(event.currentTarget.value.replace(/\D/g, "").slice(0, 6))} disabled={busy} aria-describedby={error ? "policy-authenticator-error" : undefined}/>
        {error ? <p id="policy-authenticator-error" role="alert" className={styles.error}>{error}</p> : null}
        <div className={styles.actions}>
          <button type="button" onClick={() => finish(false)} disabled={busy}>Hủy · giữ bản nháp</button>
          <button type="submit" disabled={busy}>{busy ? "Đang xác minh…" : "Xác minh và lưu"}</button>
        </div>
      </form>
    </section>
  </div>;
}

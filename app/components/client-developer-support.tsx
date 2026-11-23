"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import styles from "./client-admin-shell.module.css";

type DeveloperSupportProps = {
  appId: string;
  appName: string;
  connection: { state: "online" | "warning"; label: string };
  roleLabel: string;
};

/**
 * Read-only operator support. Auth belongs to the calling admin workspace:
 * no device approval, grant, role elevation, diagnostic mutation or AI call here.
 */
export function ClientDeveloperSupport({
  appId, appName, connection, roleLabel,
}: DeveloperSupportProps) {
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState("");

  // Only non-secret, already-visible presentation metadata.
  // No device codes, tokens, user identity, customer records, source code or inferred QA PASS.
  const report = [
    "BLUEPRINT OS 1.3.0 — APP BUILDER SUPPORT / DRAFT",
    "App: " + appName,
    "App ID: " + appId,
    "Admin role label: " + roleLabel,
    "Connection display: " + connection.state + " / " + connection.label,
    "Exact source HEAD: UNVERIFIED — inspect GitHub before changing code",
    "Reproduction steps: [fill in]",
    "Expected behavior: [fill in]",
    "Observed error/log (redact secrets): [fill in]",
    "Focused and regression QA: NOT_RUN",
    "Reviewer authority: NOT_VERIFIED",
    "Production authority: NOT_GRANTED_BY_THIS_REPORT",
    "Next bounded action: [fill in]",
  ].join("\n");

  async function copyReport() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(report);
      setCopyState("Đã sao chép gói hỗ trợ. Bạn tự quyết định gửi ở đâu.");
    } catch {
      setCopyState("Không truy cập được Clipboard. Chọn và sao chép nội dung trong ô bên dưới.");
    }
  }

  function closeOnEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    triggerRef.current?.focus();
    setExpanded(false);
  }

  return <section
    className={styles.developerSupport}
    data-client-developer-support="read-only-v1"
    data-app-id={appId}
  >
    <button
      type="button"
      className={styles.developerSupportTrigger}
      ref={triggerRef}
      aria-expanded={expanded}
      aria-controls={panelId}
      onClick={() => {
        setCopyState("");
        setExpanded((value) => !value);
      }}
    >
      <span aria-hidden="true">🛠</span>
      <span><strong>Hỗ trợ người làm app</strong><small>Blueprint · kiểm tra · khắc phục</small></span>
      <span aria-hidden="true">{expanded ? "▴" : "▾"}</span>
    </button>
    <div id={panelId} className={styles.developerSupportPanel} hidden={!expanded} onKeyDown={closeOnEscape}>
      <strong>App Builder PRO — hỗ trợ kỹ thuật</strong>
      <p>Đây là bảng hỗ trợ chỉ đọc cho người quản trị đã vào được workspace. Không phải chức năng gia sư hay quyền chỉnh sửa Production.</p>
      <dl>
        <div><dt>Ứng dụng</dt><dd>{appName}</dd></div>
        <div><dt>Vai trò hiển thị</dt><dd>{roleLabel}</dd></div>
        <div><dt>Kết nối do app báo</dt><dd>{connection.label}</dd></div>
        <div><dt>SHA / QA / phát hành</dt><dd>Chưa xác minh tại bảng này</dd></div>
      </dl>
      <nav aria-label="Công cụ hỗ trợ người phát triển" className={styles.developerSupportLinks}>
        <Link href="/tools/contract-diagnostics">Kiểm tra contract hiện có</Link>
        <a href="https://github.com/BlueDragon33/Software-Blueprint-Hub/blob/main/docs/UNIVERSAL-CONSTITUTION.md" target="_blank" rel="noopener noreferrer">Hiến pháp ACTIVE — kiểm tra bản live</a>
        <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Mở ChatGPT để phân tích thủ công</a>
      </nav>
      <p>Quy trình: tái hiện lỗi → phân loại → tìm nguyên nhân → sửa tối thiểu → regression → bằng chứng → reviewer/Owner. Không tự PASS, merge hay publish.</p>
      <button type="button" className={styles.developerSupportCopy} onClick={() => { void copyReport(); }}>Sao chép gói chẩn đoán</button>
      <p className={styles.developerSupportMessage} role="status" aria-live="polite">{copyState}</p>
      <label htmlFor={panelId + "-report"}>Báo cáo chỉ đọc — có thể sao chép thủ công</label>
      <textarea id={panelId + "-report"} readOnly rows={6} value={report} />
      <p className={styles.developerSupportWarning}>Chưa kết nối AI sửa mã, chạy QA, tạo ticket hay thực hiện thay đổi tự động từ bảng này. Các thao tác được bảo vệ vẫn phải qua backend/role gate hợp lệ.</p>
    </div>
  </section>;
}

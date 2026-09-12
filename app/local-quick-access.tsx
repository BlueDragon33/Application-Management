"use client";

import { useEffect } from "react";
import styles from "./center-admin.module.css";

const LOCAL_WEB_TARGETS = [
  { names: ["Bơi ếch"], appId: "boi-ech" },
  { names: ["Sức khỏe Y tế"], appId: "health-care" },
  { names: ["Hòa nhập Nga"], appId: "ru-life" },
  { names: ["Bauman Hub", "Bauman"], appId: "bauman-master-ai" },
] as const;

const TOOL_LINKS = [
  { id: "secret-generator", label: "Tạo Key / Secret", href: "/tools/secret-generator" },
  { id: "contract-diagnostics", label: "Chẩn đoán contract", href: "/tools/contract-diagnostics" },
] as const;

function isLoopback(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
}

function installToolLinks() {
  const signout = document.querySelector<HTMLAnchorElement>('a[href^="/signout-with-chatgpt"]');
  const menu = signout?.parentElement;
  if (!menu || !signout) return;

  for (const tool of TOOL_LINKS) {
    if (menu.querySelector(`[data-control-tool="${tool.id}"]`)) continue;
    const link = document.createElement("a");
    link.href = tool.href;
    link.textContent = tool.label;
    link.dataset.controlTool = tool.id;
    menu.insertBefore(link, signout);
  }
}

function renameDeviceActions() {
  for (const button of document.querySelectorAll<HTMLButtonElement>("button")) {
    const label = button.textContent?.trim() ?? "";
    if (label === "Duyệt tự động") button.textContent = "Tự động";
    else if (label.startsWith("Loại bỏ tất cả")) button.textContent = "Xóa hết";
  }
}

function localTargetForRow(text: string) {
  return LOCAL_WEB_TARGETS.find((target) => target.names.some((name) => text.includes(name))) ?? null;
}

function replacePendingWebCells() {
  const pendingCells = [...document.querySelectorAll<HTMLSpanElement>("span")]
    .filter((node) => node.textContent?.trim() === "Chờ contract");

  for (const pending of pendingCells) {
    const row = pending.closest("article");
    if (!row) continue;
    const rowText = row.textContent ?? "";
    const target = localTargetForRow(rowText);

    if (!target) {
      if (rowText.includes("GrowUP")) pending.textContent = "Chưa có Web";
      continue;
    }

    const link = document.createElement("a");
    link.href = `/api/local-web-launch?app=${encodeURIComponent(target.appId)}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = styles.directAccess;
    link.textContent = "Truy cập web ↗";
    link.dataset.localWebFallback = "verified";
    pending.replaceWith(link);
  }
}

export default function LocalQuickAccess() {
  useEffect(() => {
    // IMPORTANT: do not mutate React-owned DOM from here. The previous
    // insertBefore/replaceWith/textContent patch caused React reconciliation
    // to throw removeChild NotFoundError in local development. Keep this
    // compatibility component inert until these controls are rendered
    // natively by ApplicationHub.
    void installToolLinks;
    void renameDeviceActions;
    void replacePendingWebCells;
    void isLoopback;
  }, []);

  return null;
}

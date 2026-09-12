"use client";

import { useEffect } from "react";
import styles from "./center-admin.module.css";

const LOCAL_WEB_TARGETS = [
  { names: ["Bơi ếch"], href: "http://127.0.0.1:3004/" },
  { names: ["Sức khỏe Y tế"], href: "http://127.0.0.1:3001/suc-khoe-tre" },
  { names: ["Hòa nhập Nga"], href: "http://127.0.0.1:3002/" },
  { names: ["Bauman Hub", "Bauman"], href: "http://127.0.0.1:3005/" },
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
    link.href = target.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = styles.directAccess;
    link.textContent = "Truy cập web ↗";
    link.dataset.localWebFallback = "true";
    pending.replaceWith(link);
  }
}

export default function LocalQuickAccess() {
  useEffect(() => {
    const loopback = isLoopback(window.location.hostname);

    const synchronize = () => {
      installToolLinks();
      if (loopback) replacePendingWebCells();
    };

    synchronize();
    const observer = new MutationObserver(synchronize);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}

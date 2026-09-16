"use client";

import { useEffect } from "react";
import { operationsAction, type OperationsBootstrap, type OperationsDevice } from "./admin-device-client";

const APPEARANCE_KEY = "application-management:appearance:v1";
const FONT_MIGRATION_KEY = "application-management:font-step-20260916";
const OPERATIONS_CACHE_KEY = "application-management:operations:v1";
const SUPPORTED_APPS = new Set(["boi-ech", "bauman-master-ai"]);
const FONT_STEPS = [14, 16, 18, 20] as const;

type Appearance = { font?: string; background?: string; fontSize?: number };

function getAppearance(): Appearance {
  try { return JSON.parse(localStorage.getItem(APPEARANCE_KEY) || "{}"); } catch { return {}; }
}

function setFontSize(size: number) {
  const next = FONT_STEPS.includes(size as (typeof FONT_STEPS)[number]) ? size : 14;
  const appearance = getAppearance();
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ ...appearance, fontSize: next }));
  document.querySelectorAll<HTMLElement>("main").forEach((node) => node.style.setProperty("--qt-user-font-size", `${next}px`));
}

function stepFont(direction: -1 | 1) {
  const appearance = getAppearance();
  const current = Number(appearance.fontSize) || 14;
  const index = Math.max(0, FONT_STEPS.findIndex((value) => value === current));
  setFontSize(FONT_STEPS[Math.max(0, Math.min(FONT_STEPS.length - 1, index + direction))]);
}

function migrateFontOneStepDown() {
  if (localStorage.getItem(FONT_MIGRATION_KEY)) return;
  const appearance = getAppearance();
  const current = Number(appearance.fontSize) || 16;
  const index = FONT_STEPS.findIndex((value) => value === current);
  const next = index > 0 ? FONT_STEPS[index - 1] : 14;
  setFontSize(next);
  localStorage.setItem(FONT_MIGRATION_KEY, "1");
}

function readOperations(): OperationsBootstrap | null {
  try {
    const raw = sessionStorage.getItem(OPERATIONS_CACHE_KEY);
    return raw ? JSON.parse(raw) as OperationsBootstrap : null;
  } catch { return null; }
}

function appFilterFromPage() {
  const selects = Array.from(document.querySelectorAll<HTMLSelectElement>("select"));
  const appSelect = selects.find((select) => Array.from(select.options).some((option) => option.value === "boi-ech") && Array.from(select.options).some((option) => option.value === "bauman-master-ai"));
  return appSelect?.value || "all";
}

function targetDevices(all = false) {
  const data = readOperations();
  if (!data) return [] as OperationsDevice[];
  const filter = appFilterFromPage();
  return data.devices.filter((device) => SUPPORTED_APPS.has(device.appId)
    && (filter === "all" || device.appId === filter)
    && (all || device.status === "pending")
    && device.canRemove);
}

async function removeDevice(device: OperationsDevice) {
  return operationsAction({
    action: "manage-client-device",
    operation: "remove",
    appId: device.appId,
    deviceId: device.deviceId,
    deviceCode: device.deviceCode,
    expectedStatus: device.status,
  });
}

async function bulkRemove() {
  const devices = targetDevices(false);
  if (!devices.length) {
    window.alert("Không có thiết bị chờ duyệt của Bơi ếch/Bauman Hub để xóa hoặc khóa.");
    return;
  }
  const boi = devices.filter((item) => item.appId === "boi-ech").length;
  const bauman = devices.filter((item) => item.appId === "bauman-master-ai").length;
  if (!window.confirm(`Xử lý toàn bộ ${devices.length} thiết bị chờ duyệt đang chọn?\nBơi ếch: xóa vĩnh viễn ${boi}.\nBauman Hub: khóa ${bauman}.`)) return;
  const button = document.querySelector<HTMLButtonElement>("[data-runtime-bulk-remove]");
  if (button) { button.disabled = true; button.textContent = "Đang xử lý…"; }
  const failures: string[] = [];
  for (const device of devices) {
    try { await removeDevice(device); }
    catch (error) { failures.push(`${device.deviceCode}: ${error instanceof Error ? error.message : "lỗi không xác định"}`); }
  }
  sessionStorage.removeItem(OPERATIONS_CACHE_KEY);
  if (failures.length) window.alert(`Đã xử lý ${devices.length - failures.length}/${devices.length}.\n${failures.join("\n")}`);
  window.location.reload();
}

function hideRedundantHeader() {
  const title = Array.from(document.querySelectorAll("h1")).find((node) => node.textContent?.includes("Bảng điều phối quản trị ứng dụng"));
  if (title) (title.closest("header") as HTMLElement | null)?.style.setProperty("display", "none", "important");

  document.querySelectorAll<HTMLElement>("small").forEach((node) => {
    if (/^v\d/i.test(node.textContent?.trim() || "")) node.style.display = "none";
  });

  Array.from(document.querySelectorAll<HTMLElement>("body *")).forEach((node) => {
    if (node.children.length === 0 && node.textContent?.trim() === "Cuộn để xem thêm") {
      const parent = node.parentElement;
      if (parent) parent.style.display = "none";
      else node.style.display = "none";
    }
  });
}

function limitAppChoices() {
  document.querySelectorAll<HTMLSelectElement>("select").forEach((select) => {
    const values = Array.from(select.options).map((option) => option.value);
    if (!values.includes("boi-ech") || !values.includes("bauman-master-ai")) return;
    Array.from(select.options).forEach((option) => {
      if (option.value !== "all" && option.value !== "boi-ech" && option.value !== "bauman-master-ai") option.remove();
    });
  });

  document.querySelectorAll<HTMLElement>("article").forEach((row) => {
    const text = row.textContent || "";
    const looksLikeAppRow = /Truy cập web|Vào quản trị/.test(text);
    if (looksLikeAppRow && !/Bơi ếch|Bauman Hub|Bauman Master AI/.test(text)) row.style.display = "none";
  });
}

function enhanceAppearanceDialog() {
  const dialog = Array.from(document.querySelectorAll<HTMLElement>("section")).find((node) => node.getAttribute("role") === "dialog" && node.textContent?.includes("Cỡ chữ"));
  if (!dialog || dialog.querySelector("[data-runtime-font-step]")) return;
  const sections = Array.from(dialog.querySelectorAll<HTMLElement>("div"));
  const sizeSection = sections.find((node) => node.textContent?.trim().startsWith("Cỡ chữ"));
  if (!sizeSection) return;
  const controls = document.createElement("div");
  controls.setAttribute("data-runtime-font-step", "1");
  controls.style.cssText = "display:flex;gap:8px;margin-top:10px;align-items:center";
  controls.innerHTML = '<button type="button" data-font-minus style="min-width:44px;padding:8px 12px">A−</button><span style="opacity:.75">Tăng/giảm nhanh cỡ chữ nội dung</span><button type="button" data-font-plus style="min-width:44px;padding:8px 12px">A+</button>';
  controls.querySelector<HTMLButtonElement>("[data-font-minus]")?.addEventListener("click", () => stepFont(-1));
  controls.querySelector<HTMLButtonElement>("[data-font-plus]")?.addEventListener("click", () => stepFont(1));
  sizeSection.appendChild(controls);
}

function addBulkRemoveButton() {
  if (!new URLSearchParams(location.search).get("view")?.includes("client-devices")) return;
  if (document.querySelector("[data-runtime-bulk-remove]")) return;
  const heading = Array.from(document.querySelectorAll("h2")).find((node) => node.textContent?.includes("Thiết bị mới"));
  const header = heading?.parentElement?.parentElement;
  if (!header) return;
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("data-runtime-bulk-remove", "1");
  button.textContent = "Xóa/khóa tất cả";
  button.style.cssText = "margin-left:8px;padding:7px 11px;border-radius:8px;border:1px solid #a94b4b;background:#6d2323;color:#fff;cursor:pointer";
  button.addEventListener("click", () => void bulkRemove());
  header.appendChild(button);
}

function interceptBrokenRemove(event: MouseEvent) {
  const button = (event.target as HTMLElement | null)?.closest("button");
  if (!button) return;
  const label = button.textContent?.trim() || "";
  if (label !== "Xóa vĩnh viễn" && label !== "Khóa") return;
  const row = button.closest("article");
  if (!row) return;
  const data = readOperations();
  if (!data) return;
  const device = data.devices.find((item) => SUPPORTED_APPS.has(item.appId) && row.textContent?.includes(item.deviceCode));
  if (!device) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  const verb = device.appId === "boi-ech" ? "xóa vĩnh viễn" : "khóa";
  if (!window.confirm(`${verb[0].toUpperCase()}${verb.slice(1)} thiết bị ${device.deviceCode}?`)) return;
  button.setAttribute("disabled", "true");
  button.textContent = "Đang xử lý…";
  void removeDevice(device).then(() => {
    sessionStorage.removeItem(OPERATIONS_CACHE_KEY);
    window.location.reload();
  }).catch((error) => {
    button.removeAttribute("disabled");
    button.textContent = label;
    window.alert(error instanceof Error ? error.message : "Không thể cập nhật thiết bị.");
  });
}

export default function RuntimeUiFixes() {
  useEffect(() => {
    migrateFontOneStepDown();
    const apply = () => {
      const appearance = getAppearance();
      setFontSize(Number(appearance.fontSize) || 14);
      hideRedundantHeader();
      limitAppChoices();
      enhanceAppearanceDialog();
      addBulkRemoveButton();
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", interceptBrokenRemove, true);
    const onPopState = () => window.setTimeout(apply, 0);
    window.addEventListener("popstate", onPopState);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", interceptBrokenRemove, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);
  return null;
}

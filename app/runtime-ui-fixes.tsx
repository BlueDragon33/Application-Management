"use client";

import { useEffect } from "react";
import { operationsAction, type OperationsBootstrap, type OperationsDevice } from "./admin-device-client";

const APPEARANCE_KEY = "application-management:appearance:v1";
const FONT_MIGRATION_KEY = "application-management:font-step-20260916";
const OPERATIONS_CACHE_KEY = "application-management:operations:v1";
const ACTIVE_APPS = new Set(["boi-ech", "bauman-master-ai"]);
const UNSUPPORTED_APP_LABELS = ["Sức khỏe Y tế", "Hòa nhập Nga", "GrowUP"];
const FONT_STEPS = [14, 16, 18, 20] as const;

type Appearance = { font?: string; background?: string; fontSize?: number };
type DeviceFilters = { appId: string; deviceType: string; timeRange: string; search: string };

function getAppearance(): Appearance {
  try { return JSON.parse(localStorage.getItem(APPEARANCE_KEY) || "{}"); } catch { return {}; }
}

function normalizedFontSize(size: number) {
  return FONT_STEPS.includes(size as (typeof FONT_STEPS)[number]) ? size as (typeof FONT_STEPS)[number] : 14;
}

function setFontSize(size: number) {
  const next = normalizedFontSize(size);
  const appearance = getAppearance();
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ ...appearance, fontSize: next }));
  document.querySelectorAll<HTMLElement>("main").forEach((node) => node.style.setProperty("--qt-user-font-size", `${next}px`));
}

function migrateFontOneStepDown() {
  if (localStorage.getItem(FONT_MIGRATION_KEY)) return;
  const appearance = getAppearance();
  const current = Number(appearance.fontSize) || 16;
  const index = FONT_STEPS.findIndex((value) => value === current);
  setFontSize(index > 0 ? FONT_STEPS[index - 1] : 14);
  localStorage.setItem(FONT_MIGRATION_KEY, "1");
}

function readOperations(): OperationsBootstrap | null {
  try {
    const raw = sessionStorage.getItem(OPERATIONS_CACHE_KEY);
    return raw ? JSON.parse(raw) as OperationsBootstrap : null;
  } catch { return null; }
}

function selectByOptions(required: string[]) {
  return Array.from(document.querySelectorAll<HTMLSelectElement>("select")).find((select) => {
    const values = new Set(Array.from(select.options).map((option) => option.value));
    return required.every((value) => values.has(value));
  });
}

function currentDeviceFilters(): DeviceFilters {
  const appSelect = selectByOptions(["boi-ech", "bauman-master-ai"]);
  const typeSelect = selectByOptions(["desktop", "tablet", "phone"]);
  const timeSelect = selectByOptions(["1", "7", "30", "all"]);
  const search = Array.from(document.querySelectorAll<HTMLInputElement>("input"))
    .find((input) => input.placeholder?.includes("Tìm theo ứng dụng"))?.value.trim().toLowerCase() || "";
  return { appId: appSelect?.value || "all", deviceType: typeSelect?.value || "all", timeRange: timeSelect?.value || "all", search };
}

function inTimeRange(device: OperationsDevice, timeRange: string) {
  if (timeRange === "all") return true;
  const raw = device.attention === "environment" ? device.lastSeenAt ?? device.createdAt : device.createdAt ?? device.lastSeenAt;
  if (!raw) return false;
  const parsed = Date.parse(raw);
  const days = Number(timeRange);
  return Number.isFinite(parsed) && Number.isFinite(days) && Date.now() - parsed <= days * 86_400_000;
}

function targetDevices() {
  const data = readOperations();
  if (!data) return [] as OperationsDevice[];
  const filters = currentDeviceFilters();
  return data.devices.filter((device) => {
    const haystack = `${device.appName} ${device.deviceCode} ${device.userLabel} ${device.deviceTypeLabel}`.toLowerCase();
    return ACTIVE_APPS.has(device.appId)
      && device.status === "pending"
      && device.canRemove
      && (filters.appId === "all" || device.appId === filters.appId)
      && (filters.deviceType === "all" || device.deviceType === filters.deviceType)
      && inTimeRange(device, filters.timeRange)
      && (!filters.search || haystack.includes(filters.search));
  });
}

async function bulkRemove() {
  const devices = targetDevices();
  if (!devices.length) {
    window.alert("Không có thiết bị chờ duyệt Bơi ếch/Bauman Hub phù hợp bộ lọc hiện tại.");
    return;
  }
  const boi = devices.filter((item) => item.appId === "boi-ech").length;
  const bauman = devices.filter((item) => item.appId === "bauman-master-ai").length;
  if (!window.confirm(`Xử lý ${devices.length} thiết bị chờ duyệt?\nBơi ếch: xóa vĩnh viễn ${boi}.\nBauman Hub: khóa ${bauman}.`)) return;

  const button = document.querySelector<HTMLButtonElement>("[data-runtime-bulk-remove]");
  if (button) { button.disabled = true; button.textContent = "Đang xử lý…"; }

  const failures: string[] = [];
  for (const device of devices) {
    try {
      await operationsAction({
        action: "manage-client-device",
        operation: "remove",
        appId: device.appId,
        deviceId: device.deviceId,
        deviceCode: device.deviceCode,
        expectedStatus: device.status,
      });
    } catch (error) {
      failures.push(`${device.deviceCode}: ${error instanceof Error ? error.message : "lỗi không xác định"}`);
    }
  }

  sessionStorage.removeItem(OPERATIONS_CACHE_KEY);
  if (failures.length) window.alert(`Đã xử lý ${devices.length - failures.length}/${devices.length}.\n${failures.join("\n")}`);
  window.location.reload();
}

function filterInactiveApplications() {
  document.querySelectorAll<HTMLSelectElement>("select").forEach((select) => {
    const values = Array.from(select.options).map((option) => option.value);
    if (!values.includes("boi-ech") || !values.includes("bauman-master-ai")) return;
    Array.from(select.options).forEach((option) => {
      if (option.value !== "all" && !ACTIVE_APPS.has(option.value)) option.remove();
    });
    if (select.value !== "all" && !ACTIVE_APPS.has(select.value)) {
      select.value = "all";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  document.querySelectorAll<HTMLElement>("article, .modernAppsRow").forEach((row) => {
    const text = row.textContent || "";
    if (UNSUPPORTED_APP_LABELS.some((label) => text.includes(label))) row.style.display = "none";
  });

  Array.from(document.querySelectorAll<HTMLElement>("button")).forEach((button) => {
    if (!button.textContent?.includes("Tổng ứng dụng")) return;
    const count = button.querySelector("strong");
    if (count) count.textContent = "2";
  });
}

function enhanceAppearanceDialog() {
  const dialog = Array.from(document.querySelectorAll<HTMLElement>("section"))
    .find((node) => node.getAttribute("role") === "dialog" && node.textContent?.includes("Cỡ chữ"));
  if (!dialog || dialog.querySelector("[data-runtime-font-step]")) return;

  const sizeSection = Array.from(dialog.querySelectorAll<HTMLElement>("div"))
    .find((node) => node.textContent?.trim().startsWith("Cỡ chữ"));
  if (!sizeSection) return;

  const controls = document.createElement("div");
  controls.setAttribute("data-runtime-font-step", "1");
  controls.style.cssText = "display:flex;gap:8px;margin-top:10px;align-items:center";
  controls.innerHTML = '<button type="button" data-font-minus style="min-width:44px;padding:8px 12px">A−</button><span style="flex:1;opacity:.75">Tăng/giảm nhanh cỡ chữ nội dung</span><button type="button" data-font-plus style="min-width:44px;padding:8px 12px">A+</button>';

  const step = (direction: -1 | 1) => {
    const current = Number(getAppearance().fontSize) || 14;
    const index = Math.max(0, FONT_STEPS.findIndex((value) => value === current));
    const next = FONT_STEPS[Math.max(0, Math.min(FONT_STEPS.length - 1, index + direction))];
    const nativeButton = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes(`${next} px`));
    nativeButton?.click();
    setFontSize(next);
  };

  controls.querySelector<HTMLButtonElement>("[data-font-minus]")?.addEventListener("click", () => step(-1));
  controls.querySelector<HTMLButtonElement>("[data-font-plus]")?.addEventListener("click", () => step(1));
  sizeSection.appendChild(controls);
}

function addBulkRemoveButton() {
  const view = new URLSearchParams(location.search).get("view");
  if (view !== "devices" && view !== "client-devices") return;
  if (document.querySelector("[data-runtime-bulk-remove]")) return;

  const heading = Array.from(document.querySelectorAll("h2")).find((node) => node.textContent?.includes("Thiết bị"));
  const header = heading?.closest("header") ?? heading?.parentElement;
  if (!header) return;

  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("data-runtime-bulk-remove", "1");
  button.textContent = "Xóa/khóa tất cả";
  button.title = "Bơi ếch xóa vĩnh viễn; Bauman Hub khóa quyền. Chỉ áp dụng thiết bị pending đang khớp bộ lọc.";
  button.style.cssText = "margin-left:auto;padding:7px 11px;border-radius:8px;border:1px solid #a94b4b;background:#6d2323;color:#fff;cursor:pointer";
  button.addEventListener("click", () => void bulkRemove());
  header.appendChild(button);
}

function applyLightweightFixes() {
  const appearance = getAppearance();
  setFontSize(Number(appearance.fontSize) || 14);
  filterInactiveApplications();
  enhanceAppearanceDialog();
  addBulkRemoveButton();
}

export default function RuntimeUiFixes() {
  useEffect(() => {
    migrateFontOneStepDown();

    let timer: number | null = null;
    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        applyLightweightFixes();
      }, 80);
    };

    schedule();
    const onClick = () => schedule();
    const onPopState = () => schedule();
    window.addEventListener("click", onClick, { passive: true });
    window.addEventListener("popstate", onPopState);

    const warmupTimers = [250, 800, 1800].map((delay) => window.setTimeout(applyLightweightFixes, delay));

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      warmupTimers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return null;
}

import { readFileSync, writeFileSync } from "node:fs";

const path = "app/application-hub.tsx";
let source = readFileSync(path, "utf8");

function replaceOnce(label, pattern, replacement) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Không tìm thấy pattern: ${label}`);
  source = next;
}

replaceOnce(
  "bulk derived state",
  /\n  const filteredClientDevices = filterClientDevices\(devices, appFilter, deviceFilter, timeFilter, search\);\n  const bulkRemovableCount = filteredClientDevices\.filter\(\(device\) => device\.canRemove\)\.length;/,
  "",
);

replaceOnce(
  "bulk remover function",
  /\nasync function removeVisibleClientDevices\(\) \{[\s\S]*?\n\}\n\n  async function saveAutomation/,
  "\n\n  async function saveAutomation",
);

replaceOnce(
  "central client device header controls",
  /action=\{<div className=\{styles\.clientDeviceActions\}><button className=\{styles\.autoApprovalButton\} onClick=\{\(\) => setAutoApprovalOpen\(true\)\} disabled=\{role !== \"owner\"\}>Tự động<\/button><button className=\{styles\.clearNotifications\} onClick=\{\(\) => void removeVisibleClientDevices\(\)\} disabled=\{Boolean\(actionBusy\) \|\| bulkRemovableCount === 0\}>\{actionBusy === \"bulk-remove\" \? \"Đang xử lý…\" : `Loại bỏ tất cả\$\{bulkRemovableCount \? ` \(\$\{bulkRemovableCount\}\)` : \"\"\}`\}<\/button><\/div>\}/,
  'action={<div className={styles.clientDeviceActions}><button className={styles.autoApprovalButton} onClick={() => setAutoApprovalOpen(true)} disabled={role !== "owner" || Boolean(actionBusy)}>Tự động</button><button className={styles.rowAction} onClick={() => void refreshOperations()} disabled={operationsBusy || Boolean(actionBusy)}><Icon name="refresh" size={15}/> Làm mới</button></div>}',
);

if (source.includes("Loại bỏ tất cả")) throw new Error("Vẫn còn nhãn bulk destructive control trong application-hub.tsx");
if (source.includes("removeVisibleClientDevices")) throw new Error("Vẫn còn removeVisibleClientDevices trong application-hub.tsx");
if (!source.includes("Yêu cầu chờ duyệt") || !source.includes(">Xóa hết</button>")) throw new Error("Không được làm mất controls của hàng đợi chờ duyệt");

writeFileSync(path, source, "utf8");
console.log("Patched application-hub.tsx: removed central bulk destructive device control; kept per-app automation and safe refresh.");

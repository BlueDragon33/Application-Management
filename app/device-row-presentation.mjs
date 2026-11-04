/**
 * Device-row presentation only: never turns a cached client flag into verified
 * presence, fabricates an owner, or fills in missing timestamps.
 * @typedef {import("./admin-device-client").OperationsDevice} Device
 */

/** @param {unknown} input */
export function validDeviceTimestamp(input) {
  if (typeof input !== "string" || !input.trim()) return null;
  const trimmed=input.trim();
  // SQLite CURRENT_TIMESTAMP stores UTC without an offset: never parse it as browser-local time.
  const normalized=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)
    ? trimmed.replace(" ","T")+"Z" : trimmed;
  const value=Date.parse(normalized);
  return Number.isFinite(value) ? value : null;
}

/** @param {number|null} timestamp */
export function formatDeviceTime(timestamp) {
  if (timestamp === null) return "Chưa có dữ liệu";
  return new Intl.DateTimeFormat("vi-VN",{
    day:"2-digit",month:"2-digit",year:"numeric",
    hour:"2-digit",minute:"2-digit",hour12:false
  }).format(timestamp);
}

/**
 * @param {Device} device
 * @param {number} [now] Epoch milliseconds for duration display.
 * @param {boolean} [snapshotVerified] A cached snapshot cannot establish current presence.
 */
export function deviceTimePresentation(device,now=Date.now(),snapshotVerified=false) {
  const created=validDeviceTimestamp(device.createdAt);
  const registeredAt=validDeviceTimestamp(device.registrationSubmittedAt);
  const seen=validDeviceTimestamp(device.lastSeenAt);
  const lastPresence=validDeviceTimestamp(device.lastPresenceAt);
  const offlineSince=validDeviceTimestamp(device.offlineSinceAt);
  const onlineAt=lastPresence ?? (device.lastPresenceAt===undefined?seen:null);
  const elapsed=offlineSince!==null&&snapshotVerified&&Number.isFinite(now)&&now>=offlineSince
    ? Math.floor((now-offlineSince)/60_000):null;
  const offlineElapsed=elapsed===null?null:elapsed<60
    ? `${elapsed} phút`:elapsed<1440
      ? `${Math.floor(elapsed/60)} giờ ${elapsed%60} phút`
      : `${Math.floor(elapsed/1440)} ngày ${Math.floor((elapsed%1440)/60)} giờ`;
  return {
    createdAt: created,
    lastSeenAt: seen,
    registeredAt: registeredAt ?? created,
    registrationLabel: registeredAt!==null?"Đăng ký":"Ghi nhận thiết bị",
    registered: registeredAt!==null?formatDeviceTime(registeredAt)
      :created!==null?formatDeviceTime(created):"Chưa có giờ yêu cầu",
    lastSeen: seen===null ? "Chưa có giờ ghi nhận" : formatDeviceTime(seen),
    onlineAt,
    onlineLabel:lastPresence!==null?"Online gần nhất":"Tín hiệu gần nhất",
    online:onlineAt===null?"Chưa có dữ liệu":formatDeviceTime(onlineAt),
    offlineAt:offlineSince,
    offlineLabel:"Offline từ (ước tính)",
    offline:offlineSince!==null?formatDeviceTime(offlineSince)
      : snapshotVerified&&device.active&&lastPresence!==null?"Chưa mất tín hiệu":"Chưa có dữ liệu",
    offlineElapsed,
  };
}

/**
 * @param {Device} device
 * @param {boolean} snapshotVerified
 * @param {number} [now]
 */
export function deviceActivityPresentation(device,snapshotVerified,now=Date.now()) {
  if (!snapshotVerified) return {
    label:"Bản lưu",detail:"Chưa xác minh tín hiệu LIVE",tone:"unverified",
    verified:false,
  };
  const lastSeen=validDeviceTimestamp(device.lastSeenAt);
  if (lastSeen===null) return {
    label:device.active ? "Client báo hoạt động" : "Chưa có tín hiệu",
    detail:"Không có thời điểm xác minh",tone:"unknown",verified:false,
  };
  const age=now-lastSeen;
  if (age < -5*60_000) return {
    label:"Sai mốc thời gian",detail:"Giờ ghi nhận ở tương lai; cần kiểm tra đồng hồ thiết bị",
    tone:"warning",verified:false,
  };
  if (device.active && age>=0 && age<=5*60_000) return {
    label:"Có tín hiệu gần đây",detail:"Theo báo cáo của ứng dụng nguồn, chưa xác minh phiên trực tuyến",
    tone:"recent",verified:false,
  };
  if (device.active) return {
    label:"Tín hiệu đã cũ",detail:"Client còn đánh dấu active; cần đồng bộ lại",
    tone:"stale",verified:false,
  };
  return {
    label:"Chưa báo hoạt động",detail:"Không đồng nghĩa xác nhận thiết bị offline",
    tone:"unknown",verified:false,
  };
}

/**
 * Only a label is available from the per-app contract. Repeated labels may
 * belong to the same person; never infer individual identity from device code.
 * @param {Device} device
 * @param {number} repeatedLabelCount
 */
export function deviceUserPresentation(device,repeatedLabelCount=1) {
  const name=typeof device.userLabel==="string"?device.userLabel.trim():"";
  const generic=!name || name==="—" ||
    name.toLowerCase()===(device.deviceCode??"").trim().toLowerCase() ||
    name==="Thiết bị chưa gắn người dùng";
  return {
    primary:generic?"Chưa định danh người dùng":name,
    secondary:generic?"Thiết bị chưa cung cấp tên/tài khoản":
      repeatedLabelCount>1?`Cùng nhãn trên ${repeatedLabelCount} thiết bị`:"Nhãn từ ứng dụng nguồn",
    tone:generic?"unidentified":repeatedLabelCount>1?"shared":"named",
    rawLabel:name||null,
  };
}

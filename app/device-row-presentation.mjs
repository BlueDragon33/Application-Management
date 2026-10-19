/**
 * Device-row presentation only: never turns a cached client flag into verified
 * presence, fabricates an owner, or fills in missing timestamps.
 * @typedef {import("./admin-device-client").OperationsDevice} Device
 */

/** @param {unknown} input */
export function validDeviceTimestamp(input) {
  if (typeof input !== "string" || !input.trim()) return null;
  const value=Date.parse(input);
  return Number.isFinite(value) ? value : null;
}

/** @param {number|null} timestamp */
export function formatDeviceTime(timestamp) {
  if (timestamp === null) return "Chưa có dữ liệu";
  return new Intl.DateTimeFormat("vi-VN",{
    timeZone: "Asia/Ho_Chi_Minh", day:"2-digit",month:"2-digit",year:"numeric",
    hour:"2-digit",minute:"2-digit",hour12:false
  }).format(timestamp);
}

/** @param {Device} device */
export function deviceTimePresentation(device) {
  const created=validDeviceTimestamp(device.createdAt);
  const seen=validDeviceTimestamp(device.lastSeenAt);
  return {
    createdAt: created,
    lastSeenAt: seen,
    registered: created===null ? "Chưa có giờ yêu cầu" : formatDeviceTime(created),
    lastSeen: seen===null ? "Chưa có giờ ghi nhận" : formatDeviceTime(seen),
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

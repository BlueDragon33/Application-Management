"use client";

import {useEffect,useRef,type KeyboardEvent} from "react";
import styles from "./operating-mode-dialog.module.css";

export type OperatingMode = "local" | "online" | "hybrid";

export function availableOperatingMode(mode: OperatingMode, localAllowed: boolean): boolean {
  return mode !== "local" || localAllowed;
}
export function operatingModeLabel(mode: OperatingMode): string {
  return mode === "local" ? "Cục bộ" : mode === "online" ? "Trực tuyến" : "Kết hợp";
}
export function hasProtectedOperationAccess(mode: OperatingMode, verifiedLiveActor: boolean): boolean {
  // UI-only advisory. The mutation endpoint independently verifies authorization.
  return mode !== "local" && verifiedLiveActor === true;
}
const modes: ReadonlyArray<{id:OperatingMode;title:string;desc:string}> = [
  {id:"local",title:"Cục bộ · Offline",desc:"Ưu tiên dữ liệu lưu trên thiết bị; không gửi lệnh duyệt hoặc lưu chính sách lên máy chủ."},
  {id:"online",title:"Trực tuyến · Online",desc:"Đọc trực tiếp từ máy chủ đang mở; yêu cầu xác minh quyền và Authenticator cho thao tác nhạy cảm."},
  {id:"hybrid",title:"Kết hợp · Tự chuyển nguồn",desc:"Dùng dữ liệu trực tiếp khi có kết nối và quyền; nếu mất kết nối chỉ đọc bản lưu, không ghi mù."}
];

export default function OperatingModeDialog({mode,localAllowed,connected,authIsProduction,onSelect,onClose}:{
  mode:OperatingMode;
  localAllowed:boolean;
  connected:boolean;
  authIsProduction:boolean;
  onSelect:(next:OperatingMode)=>void;
  onClose:()=>void;
}) {
  const root=useRef<HTMLElement|null>(null);
  const close=useRef<HTMLButtonElement|null>(null);
  useEffect(()=>{
    const prev=document.activeElement instanceof HTMLElement?document.activeElement:null;
    close.current?.focus();
    return ()=>prev?.focus();
  },[]);
  function onKeyDown(event:KeyboardEvent<HTMLElement>){
    if(event.key==="Escape"){event.preventDefault();onClose();return;}
    if(event.key!=="Tab")return;
    const targets=Array.from(root.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ?? []);
    if(!targets.length)return;
    if(event.shiftKey&&document.activeElement===targets[0]){
      event.preventDefault();targets[targets.length-1].focus();
    }else if(!event.shiftKey&&document.activeElement===targets[targets.length-1]){
      event.preventDefault();targets[0].focus();
    }
  }
  return <div className={styles.backdrop} onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section className={styles.dialog} ref={root} role="dialog" aria-modal="true"
      aria-labelledby="operating-mode-title" tabIndex={-1} onKeyDown={onKeyDown}>
      <header className={styles.header}>
        <div><small>TRUNG TÂM KẾT NỐI</small><h2 id="operating-mode-title">Chế độ vận hành</h2></div>
        <button ref={close} type="button" aria-label="Đóng chế độ vận hành" onClick={onClose}>×</button>
      </header>
      <p className={styles.intro}>Chọn ngay trong App-Manager. Chế độ hiển thị không thay đổi quyền máy chủ hoặc cấu hình D1.</p>
      <div className={styles.options}>
        {modes.map(item=>{
          const allowed=availableOperatingMode(item.id,localAllowed);
          return <button key={item.id} type="button" data-current={item.id===mode}
            aria-pressed={item.id===mode} disabled={!allowed}
            onClick={()=>onSelect(item.id)} className={styles.option}>
            <strong>{item.title}{item.id===mode?" · Đang chọn":""}</strong>
            <span>{item.desc}</span>
            {!allowed?<em>Chỉ khả dụng trong phiên Standalone được cho phép</em>:null}
          </button>;
        })}
      </div>
      <div className={styles.status} role="status">
        <span>Chế độ hiện tại: <strong>{operatingModeLabel(mode)}</strong></span>
        <span>Dữ liệu trực tiếp: <strong>{connected?"Đã đồng bộ":"Chưa xác minh"}</strong></span>
      </div>
      {authIsProduction?<p className={styles.warning}>Production bắt buộc xác thực máy chủ; không thể chuyển sang Local để bỏ qua 2FA. <a href="/__account" target="_blank" rel="noopener noreferrer">Xác minh Authenticator ↗</a></p>:null}
      <p className={styles.note}>Online trên localhost kết nối tới backend đã cấu hình cho phiên localhost, không tự động chuyển thành Production. Kết hợp là chiến lược đọc/fallback, không phải sao chép hoặc hợp nhất D1 giữa máy và cloud.</p>
    </section>
  </div>;
}

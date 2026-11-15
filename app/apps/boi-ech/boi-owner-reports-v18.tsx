"use client";

import type {BoiDeviceRegistry} from "../../boi-device-registry";
import {deviceSummary} from "./boi-owner-device-summary";
import styles from "./boi-owner-reports-v18.module.css";

type LegacyDevice={status:"pending"|"approved"|"blocked";active:boolean;personRole:string|null;completionPercent:number;learnerName:string|null};
type Props={registry:BoiDeviceRegistry|null|undefined;legacy:LegacyDevice[];verified:boolean;onExport:()=>void;onDevices:()=>void};
const format=(value:number|undefined)=>value===undefined?"—":value.toLocaleString("vi-VN");
export default function BoiOwnerReportsV18({registry,legacy,verified,onExport,onDevices}:Props){
 const hasRegistry=verified&&!!registry;
 const fromRegistry=hasRegistry?deviceSummary(registry.devices):null;
 const total=verified?(fromRegistry?.total??legacy.length):undefined;
 const pending=verified?(fromRegistry?.pending??legacy.filter(d=>d.status==="pending").length):undefined;
 const blocked=verified?(fromRegistry?.blocked??legacy.filter(d=>d.status==="blocked").length):undefined;
 const trusted=verified?(fromRegistry?.approved??legacy.filter(d=>d.status==="approved").length):undefined;
 const percent=(n:number|undefined)=>total&&n!==undefined?Math.round(n/total*100):0;
 const teacherSet=hasRegistry?new Set(registry.devices.filter(d=>d.account?.role==="teacher").map(d=>d.account?.accountId).filter(Boolean)):null;
 const learnerSet=hasRegistry?new Set(registry.devices.filter(d=>d.account?.role==="learner").map(d=>d.account?.accountId).filter(Boolean)):null;
 return <section className={styles.shell} aria-label="Báo cáo Bơi Ếch từ dữ liệu đã xác minh">
  <div className={styles.head}>
   <div><small>OWNER · VERIFIED ANALYTICS</small><h2>Báo cáo & Thống kê</h2>
    <p>Phân tích liên kết và trạng thái theo nguồn Bơi Ếch thực tế. Không quy đổi liên kết thành tổng số người.</p></div>
   <div className={styles.actions}>
    <button type="button" onClick={onExport} disabled={!verified}>⇧ Xuất CSV đã xác minh</button>
    <button type="button" onClick={onDevices}>Xem thiết bị →</button>
   </div>
  </div>
  <div className={styles.kpis}>
   {([{name:"Liên kết đang quản lý",value:total,tone:"blue"},
     {name:"Đã tin cậy",value:trusted,tone:"green"},
     {name:"Chờ xác nhận",value:pending,tone:"amber"},
     {name:"Đã thu hồi",value:blocked,tone:"purple"}] as const).map(card=>
    <article key={card.name} data-tone={card.tone}><small>{card.name}</small><strong>{format(card.value)}</strong>
      <span>{verified?"Dữ liệu từ bản đọc lại máy chủ":"Chưa có dữ liệu xác minh"}</span></article>)}
  </div>
  <div className={styles.columns}>
   <section className={styles.card} aria-label="Phân bố trạng thái liên kết">
    <h3>Phân bố trạng thái liên kết</h3>
    {total!==undefined?<div className={styles.bars}>
      {([{name:"Đã tin cậy",count:trusted??0,tone:"green"},
        {name:"Chờ xác nhận",count:pending??0,tone:"amber"},
        {name:"Đã thu hồi",count:blocked??0,tone:"purple"}] as const).map(x=>
       <div className={styles.bar} key={x.name}>
        <div><strong>{x.name}</strong><span>{x.count} · {percent(x.count)}%</span></div>
        <progress max={Math.max(total,1)} value={x.count} data-tone={x.tone} aria-label={x.name}/>
       </div>)}
     </div>:<p className={styles.empty}>Cần đọc lại dữ liệu đã xác minh trước khi tạo biểu đồ.</p>}
   </section>
   <section className={styles.card} aria-label="Phân loại liên kết thiết bị theo loại trình duyệt">
    <h3>Loại trình duyệt</h3>
    {fromRegistry?<div className={styles.bars}>
      {fromRegistry.categories.map(x=><div className={styles.bar} key={x.kind}>
       <div><strong>{x.title}</strong><span>{x.total} liên kết</span></div>
       <progress max={Math.max(total??0,1)} value={x.total} aria-label={x.title}/>
      </div>)}
     </div>:<p className={styles.empty}>Phiên dữ liệu này chưa cung cấp loại trình duyệt đã xác minh. Không tự suy đoán điện thoại/iPad/laptop.</p>}
   </section>
  </div>
  <div className={styles.roleGrid}>
   <section className={styles.roleCard} data-role="teacher"><small>Giảng viên có liên kết</small>
    <strong>{teacherSet?format(teacherSet.size):"—"}</strong>
    <p>Số tài khoản Giảng viên duy nhất có thiết bị trong registry; không phải tổng giảng viên của hệ thống.</p></section>
   <section className={styles.roleCard} data-role="learner"><small>Học viên có liên kết</small>
    <strong>{learnerSet?format(learnerSet.size):"—"}</strong>
    <p>Số tài khoản Học viên duy nhất có thiết bị trong registry; không phải tổng học viên đã đăng ký.</p></section>
   <section className={styles.roleCard} data-role="progress"><small>Tiến độ bình quân Học viên</small>
    <strong>{fromRegistry?.learning?`${fromRegistry.learning.average}%`:"—"}</strong>
    <p>{fromRegistry?.learning?`${fromRegistry.learning.total} tài khoản Học viên có dữ liệu tiến độ xác minh.`:"Chưa đủ bằng chứng học tập để tính bình quân."}</p></section>
  </div>
  <p className={styles.source} role="status">Trạng thái dữ liệu: <b>{verified?"Đã đọc từ máy chủ":"Chưa xác minh"}</b>.
   Số liên kết ≠ số tài khoản ≠ số thiết bị vật lý. Xuất báo cáo vẫn sử dụng endpoint/quyền sẵn có và không tạo dữ liệu mới.</p>
 </section>;
}

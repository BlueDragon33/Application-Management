"use client";

import {useId} from "react";
import type {BoiDeviceRegistry} from "../../boi-device-registry";
import {deviceSummary,deviceCategoryMeta as categoryMeta,type DeviceKind,type RegistryDeviceKind as Kind} from "./boi-owner-device-summary";
export type {DeviceKind} from "./boi-owner-device-summary";
import styles from "./boi-owner-device-insights.module.css";

export function BoiClientDeviceIcon({kind,size=54}:{kind:Kind;size?:number}){
 const gradientId=useId().replace(/:/g,"");
 return <svg width={size} height={size} viewBox="0 0 76 76" aria-hidden="true" focusable="false"
  fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
  <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
    <stop stopColor="#62ddff"/><stop offset=".55" stopColor="#3589ff"/><stop offset="1" stopColor="#9f64ff"/></linearGradient></defs>
  {kind==="phone"?<>
   <rect x="23" y="4" width="31" height="67" rx="7" stroke="#c3efff"/>
   <rect x="27" y="12" width="23" height="47" rx="2.5" fill={`url(#${gradientId})`} stroke="#8fd8ff"/>
   <path d="M34 8h10M36 65h4" stroke="#ccefff"/>
   <path d="M29 44c8-17 12-2 20-18" stroke="#f2eaff" opacity=".9"/>
  </>:null}
  {kind==="tablet"?<>
   <rect x="11" y="5" width="54" height="66" rx="7" stroke="#c3efff"/>
   <rect x="17" y="10" width="42" height="54" rx="2" fill={`url(#${gradientId})`} stroke="#89dcff"/>
   <circle cx="38" cy="67" r="1.5" fill="#daf8ff" stroke="none"/>
   <path d="M19 51c15-26 23-5 37-33" stroke="#f9e8ff" opacity=".8"/>
  </>:null}
  {kind==="unknown"?<><rect x="13" y="11" width="50" height="48" rx="8" stroke="#a5c9ec" strokeDasharray="4 5"/><path d="M30 30a9 9 0 1 1 13 8c-3 2-5 3-5 7M38 53h.01" stroke="#d4ecff"/></>:null}
  {kind==="desktop"?<>
   <rect x="10" y="8" width="56" height="43" rx="4" stroke="#c6f2ff" fill="#0d2e67"/>
   <rect x="14" y="12" width="48" height="34" rx="1.5" fill={`url(#${gradientId})`} stroke="#7ccfff"/>
   <path d="M7 56h62l5 10H2z" fill="#7190d7" stroke="#b8e7ff"/>
   <path d="M18 61h40M32 65h12M15 37c12-21 22 3 41-14" stroke="#f0eaff" opacity=".85"/>
  </>:null}
 </svg>;
}
function Kpi({label,value,detail,tone}:{label:string;value:string;detail:string;tone:string}){
 return <article className={styles.metric} data-tone={tone}><small>{label}</small>
   <strong>{value}</strong><span>{detail}</span></article>;
}
export function BoiOwnerDeviceInsights({registry,verified,filter,onFilter}:{
 registry:BoiDeviceRegistry|null|undefined;verified:boolean;filter:DeviceKind;onFilter:(kind:DeviceKind)=>void;
}){
 const stats=registry&&verified?deviceSummary(registry.devices):null;
 return <div className={styles.shell} aria-label="Thiết bị phân theo điện thoại, iPad và laptop">
  <div className={styles.intro}><div><small>THIẾT BỊ & TIẾN ĐỘ · OWNER</small><h2>Thiết bị liên kết</h2>
   <p>Phân loại theo loại trình duyệt đã xác minh. Một thiết bị vật lý có thể có nhiều khóa trình duyệt.</p></div>
   <span className={styles.source}>Nguồn: Bơi Ếch D1 · {stats?"Đã xác minh":"Chưa xác minh"}</span></div>
  <div className={styles.metrics}>
   <Kpi label="Tổng liên kết" value={stats?String(stats.total):"—"} detail="Khóa trình duyệt" tone="blue"/>
   <Kpi label="Đã tin cậy" value={stats?String(stats.approved):"—"} detail="Đang có quyền" tone="green"/>
   <Kpi label="Chờ xác nhận" value={stats?String(stats.pending):"—"} detail="Cần xử lý" tone="amber"/>
   <Kpi label="Đã thu hồi" value={stats?String(stats.blocked):"—"} detail="Không còn quyền" tone="pink"/>
  </div>
  <div className={styles.categories} role="group" aria-label="Lọc theo loại thiết bị">
   {categoryMeta.map(item=>{
    const category=stats?.categories.find(c=>c.kind===item.kind);
    return <button key={item.kind} type="button" className={styles.category}
      data-kind={item.kind} aria-pressed={filter===item.kind} onClick={()=>onFilter(filter===item.kind?"all":item.kind)}>
     <span className={styles.art}><BoiClientDeviceIcon kind={item.kind}/></span>
     <span className={styles.catCopy}><strong>{item.title}</strong>
       <b>{category?category.total:"—"} <small>liên kết</small></b>
       <small>{item.detail}</small>
       <span className={styles.triple}>
        <span className={styles.approved}>✓ {category?category.approved:"—"}</span>
        <span className={styles.pending}>◷ {category?category.pending:"—"}</span>
        <span className={styles.blocked}>⊘ {category?category.blocked:"—"}</span>
       </span>
     </span>
    </button>;
   })}
  </div>
  <div className={styles.bottom}>
   <div className={styles.segment} role="group" aria-label="Hiển thị loại thiết bị">
    <span>Loại thiết bị:</span>
    {([{kind:"all",title:"Tất cả"} ,{kind:"phone",title:"Điện thoại"},
       {kind:"tablet",title:"iPad / Tablet"},{kind:"desktop",title:"Laptop / máy tính"}] as const).map(t=>
      <button key={t.kind} type="button" aria-pressed={filter===t.kind}
       onClick={()=>onFilter(t.kind)}>{t.title}</button>)}
   </div>
   <section className={styles.learning} aria-label="Tiến độ học tập của tài khoản đã có bằng chứng">
    <div><strong>Tiến độ học tập đã xác minh</strong>
     <small>{stats?.learning?`${stats.learning.total} tài khoản Học viên có dữ liệu`:"Chưa có đủ dữ liệu tiến độ để tính"}</small></div>
    {stats?.learning?<div className={styles.progress}>
      <div className={styles.ring} style={{"--p":stats.learning.average+"%"} as React.CSSProperties}>
       <strong>{stats.learning.average}%</strong><small>TB</small>
      </div>
      <div className={styles.buckets}>
       <span>0–29% <b>{stats.learning.low}</b></span>
       <span>30–69% <b>{stats.learning.medium}</b></span>
       <span>70–100% <b>{stats.learning.high}</b></span>
      </div>
    </div>:<p>Không tự suy đoán tiến độ từ trạng thái của thiết bị. Số liệu chỉ hiển thị khi D1 trả về kết quả học tập của tài khoản.</p>}
   </section>
  </div>
  <p className={styles.note}>{stats?.unclassified?`${stats.unclassified} liên kết chưa có bằng chứng phân loại trình duyệt. `:""}“Laptop / máy tính” là nhóm trình duyệt desktop. Hệ thống không khẳng định thiết bị vật lý là laptop hay máy bàn; tiến độ học tập gắn với tài khoản chứ không gắn riêng từng khóa trình duyệt.</p>
 </div>;
}

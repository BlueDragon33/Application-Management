"use client";

import type {BoiDeviceBinding,BoiDeviceRegistry} from "../../boi-device-registry";
import styles from "./boi-owner-device-insights.module.css";

export type DeviceKind="all"|"phone"|"tablet"|"desktop";
type Kind=Exclude<DeviceKind,"all">;

const categoryMeta=[
 {kind:"phone",title:"Điện thoại",detail:"Trình duyệt trên điện thoại",glyph:"phone"},
 {kind:"tablet",title:"iPad / Tablet",detail:"Máy tính bảng / iPad",glyph:"tablet"},
 {kind:"desktop",title:"Laptop / máy tính",detail:"Nhận diện trình duyệt máy tính",glyph:"laptop"}
] as const;

export function BoiClientDeviceIcon({kind,size=54}:{kind:Kind;size?:number}){
 return <svg width={size} height={size} viewBox="0 0 76 76" aria-hidden="true" focusable="false"
  fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
  <defs><linearGradient id={"device-icon-"+kind} x1="0" y1="0" x2="1" y2="1">
    <stop stopColor="#62ddff"/><stop offset=".55" stopColor="#3589ff"/><stop offset="1" stopColor="#9f64ff"/></linearGradient></defs>
  {kind==="phone"?<>
   <rect x="23" y="4" width="31" height="67" rx="7" stroke="#c3efff"/>
   <rect x="27" y="12" width="23" height="47" rx="2.5" fill={"url(#device-icon-"+kind+")"} stroke="#8fd8ff"/>
   <path d="M34 8h10M36 65h4" stroke="#ccefff"/>
   <path d="M29 44c8-17 12-2 20-18" stroke="#f2eaff" opacity=".9"/>
  </>:null}
  {kind==="tablet"?<>
   <rect x="11" y="5" width="54" height="66" rx="7" stroke="#c3efff"/>
   <rect x="17" y="10" width="42" height="54" rx="2" fill={"url(#device-icon-"+kind+")"} stroke="#89dcff"/>
   <circle cx="38" cy="67" r="1.5" fill="#daf8ff" stroke="none"/>
   <path d="M19 51c15-26 23-5 37-33" stroke="#f9e8ff" opacity=".8"/>
  </>:null}
  {kind==="desktop"?<>
   <rect x="10" y="8" width="56" height="43" rx="4" stroke="#c6f2ff" fill="#0d2e67"/>
   <rect x="14" y="12" width="48" height="34" rx="1.5" fill={"url(#device-icon-"+kind+")"} stroke="#7ccfff"/>
   <path d="M7 56h62l5 10H2z" fill="#7190d7" stroke="#b8e7ff"/>
   <path d="M18 61h40M32 65h12M15 37c12-21 22 3 41-14" stroke="#f0eaff" opacity=".85"/>
  </>:null}
 </svg>;
}
const classKind=(row:BoiDeviceBinding):Kind=>row.clientClass==="phone"?"phone":row.clientClass==="tablet"?"tablet":"desktop";
export function classifyBinding(row:BoiDeviceBinding):Kind{return classKind(row);}
export function deviceSummary(devices:BoiDeviceBinding[]){
 const count=(filter:(r:BoiDeviceBinding)=>boolean)=>devices.filter(filter).length;
 const categories=categoryMeta.map(x=>{
  const records=devices.filter(d=>classKind(d)===x.kind);
  return {...x,total:records.length,approved:records.filter(d=>d.status==="approved").length,
   pending:records.filter(d=>d.status==="pending").length,
   blocked:records.filter(d=>d.status==="blocked").length};
 });
 // Progress belongs to a signed-in learner ACCOUNT, not to individual browser keys.
 // Each account is counted once, only when the owner registry provides a verified record.
 const unique=new Map<string,number>();
 for(const item of devices){
  if(item.account?.role!=="learner"||!item.account.accountId||!item.progress||
    !Number.isSafeInteger(item.progress.completed)||!Number.isSafeInteger(item.progress.total)||
    item.progress.total<=0||item.progress.completed<0||item.progress.completed>item.progress.total)continue;
  const n=Math.round(item.progress.completed/item.progress.total*100);
  const old=unique.get(item.account.accountId);
  if(old===undefined)unique.set(item.account.accountId,n);
  // Deliberately do not average contradictory browser data for the same account.
 }
 const progress=[...unique.values()];
 const learning=progress.length?{
  total:progress.length,average:Math.round(progress.reduce((a,b)=>a+b,0)/progress.length),
  low:progress.filter(n=>n<30).length,
  medium:progress.filter(n=>n>=30&&n<70).length,
  high:progress.filter(n=>n>=70).length
 }:null;
 return {total:devices.length,approved:count(d=>d.status==="approved"),
  pending:count(d=>d.status==="pending"),blocked:count(d=>d.status==="blocked"),
  categories,learning};
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
  <p className={styles.note}>“Laptop / máy tính” là nhóm trình duyệt desktop. Hệ thống không khẳng định thiết bị vật lý là laptop hay máy bàn; tiến độ học tập gắn với tài khoản chứ không gắn riêng từng khóa trình duyệt.</p>
 </div>;
}

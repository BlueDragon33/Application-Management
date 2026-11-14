"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import AuthenticatorStepUp from "../../authenticator-step-up";
import {previewOwnerManagerPurge,purgeOwnerManagerAccount,
 type BoiManagerPurgeRecord} from "../../boi-access-client";
import styles from "./owner-manager-purge.module.css";

const MAX=10;
const when=(value:string|null)=>{
 if(!value)return "Không có";
 const date=new Date(value);
 return Number.isFinite(date.getTime())
  ?new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short",
    timeZone:"Europe/Moscow"}).format(date)+" (Moscow)":"Chưa xác minh";
};
export default function OwnerManagerPurgePanel({onChanged=()=>{},surface="launch",onManage,durations=[]}: {
 onChanged?:()=>void;surface?:"launch"|"cards";onManage?:(accountId:string)=>void;
 durations?:{accountId:string;expiresAt:string|null;state:string|null;active:boolean}[];
}){
 const [open,setOpen]=useState(false);
 const [filter,setFilter]=useState<"all"|"pending"|"blocked"|"active"|"eligible">("all");
 const [search,setSearch]=useState("");
 const [rows,setRows]=useState<BoiManagerPurgeRecord[]>([]);
 const [scanned,setScanned]=useState(false);
 const [nextCursor,setNextCursor]=useState<string|null>(null);
 const [selected,setSelected]=useState<string[]>([]);
 const [reason,setReason]=useState("Owner xác nhận xóa sạch hồ sơ quản lý cũ không có hoạt động hoặc dữ liệu");
 const [confirmation,setConfirmation]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 const [authRequired,setAuthRequired]=useState<"verify"|"setup"|null>(null);
 const authResolver=useRef<((value:boolean)=>void)|null>(null);
 const lock=useRef(false);
 const mounted=useRef(true);
 const trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;
   authResolver.current?.(false);authResolver.current=null;}},[]);
 useEffect(()=>{
  if(!open)return;
  const closeOnEscape=(event:KeyboardEvent)=>{
   if(event.key==="Escape"&&!busy&&!authRequired){setOpen(false);trigger.current?.focus();}
  };
  document.addEventListener("keydown",closeOnEscape);
  const previous=document.body.style.overflow;
  document.body.style.overflow="hidden";
  return()=>{document.removeEventListener("keydown",closeOnEscape);document.body.style.overflow=previous;};
 },[open,busy,authRequired]);
 const eligible=useMemo(()=>rows.filter(r=>r.eligible),[rows]);
 const chosen=useMemo(()=>rows.filter(r=>r.eligible&&selected.includes(r.accountId)),[rows,selected]);
 const visible=useMemo(()=>rows.filter(r=>{
   const state=r.accessStatus==="blocked"?"blocked":r.accessStatus==="pending"?"pending":"active";
   if(filter==="eligible"&&!r.eligible)return false;
   if(filter!=="all"&&filter!=="eligible"&&filter!==state)return false;
   return [r.accountId,r.name,r.stage].join(" ").toLocaleLowerCase("vi")
    .includes(search.trim().toLocaleLowerCase("vi"));
 }),[rows,filter,search]);
 const readyVisible=visible.filter(r=>r.eligible);
 async function scan(cursor?:string){
  if(lock.current)return;lock.current=true;setBusy(true);setError("");setMessage("");
  try{
   const result=await previewOwnerManagerPurge(cursor);
   if(!mounted.current)return;
   setRows(previous=>cursor?[...previous.filter(x=>!result.records.some(y=>y.accountId===x.accountId)),...result.records]:result.records);
   setScanned(true);setNextCursor(result.nextCursor);
   if(!cursor){setSelected([]);setConfirmation("");}
  }catch(e){if(mounted.current){setError(e instanceof Error?e.message:"Chưa xác minh được danh sách từ D1.");
    if(!cursor){setRows([]);setScanned(false);setSelected([]);setNextCursor(null);}}}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 useEffect(()=>{if(surface==="cards")queueMicrotask(()=>{void scan();});
  // One scan when a routed card surface becomes visible. Further refresh is manual.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[surface]);
 function finishAuth(verified:boolean){
  setAuthRequired(null);authResolver.current?.(verified);authResolver.current=null;
 }
 async function withOwnerAuth<T,>(operation:()=>Promise<T>):Promise<T>{
  try{return await operation();}
  catch(e){
   const d=e instanceof Error?(e as Error&{data?:Record<string,unknown>}).data:undefined;
   if(d?.code!=="STEP_UP_REQUIRED"||d.applied!==false||!mounted.current)throw e;
   setAuthRequired(d.authenticatorSetupRequired===true?"setup":"verify");
   const allowed=await new Promise<boolean>(resolve=>{authResolver.current=resolve;});
   if(!allowed||!mounted.current)throw new Error("Đã hủy xác minh Authenticator; chưa xóa.");
   return operation();
  }
 }
 async function purge(){
  if(lock.current||!chosen.length||chosen.length>MAX)return;
  if(reason.trim().length<10||confirmation!=="XOA VINH VIEN CAN BO"){
   setError("Nhập lý do ít nhất 10 ký tự và chính xác XOA VINH VIEN CAN BO.");return;
  }
  if(!window.confirm("Xóa vĩnh viễn "+chosen.length+" tài khoản cán bộ đã chọn, cùng hồ sơ và khóa trong D1? "+
   "Không thể hoàn tác. Chỉ tài khoản được máy chủ xác nhận đủ điều kiện mới xóa được."))return;
  lock.current=true;setBusy(true);setError("");setMessage("");
  let completed=0;
  try{
   for(const record of chosen){
    const result=await withOwnerAuth(()=>purgeOwnerManagerAccount({
     accountId:record.accountId,snapshot:record.snapshot,reason:reason.trim()
    }));
    if(result.deleted!==true)throw new Error("Không xác minh được xóa trên D1.");
    completed++;
    if(mounted.current){setMessage("Đã xác minh xóa "+completed+"/"+chosen.length+" tài khoản. Đang xử lý bản ghi tiếp theo.");}
   }
   if(mounted.current)setMessage("Đã xóa vĩnh viễn "+completed+" tài khoản khỏi D1. Nhật ký kiểm toán tối thiểu được giữ.");
  }catch(e){if(mounted.current)setError("Đã xác minh xóa "+completed+"/"+chosen.length+
   ". Dừng ngay tại lỗi tiếp theo. KHÔNG tự gửi lại lệnh: "+
   (e instanceof Error?e.message:"Không rõ trạng thái D1."));}
  finally{
   lock.current=false;
   if(mounted.current){setBusy(false);setRows([]);setScanned(false);setSelected([]);
    setConfirmation("");setNextCursor(null);}
   if(completed>0)onChanged();
  }
 }
 const toggle=(accountId:string,on:boolean)=>{
  setSelected(ids=>on?[...ids.filter(x=>x!==accountId),accountId].slice(0,MAX):ids.filter(x=>x!==accountId));
 };
 return <>
  {surface==="cards"?<section className={styles.directPanel} aria-label="Quản lý và thanh lọc tài khoản cán bộ">
   <div className={styles.directHeading}>
    <div><span className={styles.eyebrow}>OWNER · ACCOUNT FIRST · D1</span>
     <h3>Thời hạn & tài khoản cán bộ quản lý</h3>
     <p>Chọn ngay trên từng thẻ để thanh lọc hồ sơ cũ. Tài khoản đang hoạt động hoặc có dữ liệu được bảo vệ.</p></div>
    <button type="button" className={styles.reload} disabled={busy} onClick={()=>void scan()}>
     {busy?"Đang đối chiếu D1…":"↻ Làm mới"}</button>
   </div>
   <div className={styles.stats} aria-label="Tổng hợp tài khoản">
    <div><span aria-hidden="true">♙</span><strong>{rows.length}</strong><small>Đã đọc từ D1</small></div>
    <div><span aria-hidden="true">◷</span><strong>{rows.filter(x=>x.accessStatus==="pending").length}</strong><small>Chờ xác nhận</small></div>
    <div><span aria-hidden="true">⊘</span><strong>{rows.filter(x=>x.accessStatus==="blocked").length}</strong><small>Đã thu hồi</small></div>
    <div><span aria-hidden="true">✓</span><strong>{rows.filter(x=>x.accessStatus==="approved").length}</strong><small>Đang hoạt động</small></div>
    <div><span aria-hidden="true">⌫</span><strong>{rows.filter(x=>x.eligible).length}</strong><small>Được phép xóa</small></div>
   </div>
   <div className={styles.directTools}>
    <label className={styles.searchBox}>Tìm tên hoặc mã tài khoản
     <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tên cán bộ, ID…" /></label>
    <div className={styles.filters} aria-label="Lọc trạng thái">
     {([["all","Tất cả"],["pending","Chờ xác nhận"],["blocked","Đã thu hồi"],
        ["active","Đang hoạt động"],["eligible","Đủ điều kiện xóa"]] as const).map(([key,label])=>
       <button key={key} type="button" aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}
    </div>
   </div>
   <div className={styles.bulkToolbar} role="group" aria-label="Xử lý hàng loạt có điều kiện">
    <span><strong>{chosen.length}</strong> đã chọn · {visible.length} đang hiển thị</span>
    <button type="button" disabled={busy||!readyVisible.length} onClick={()=>setSelected(readyVisible.slice(0,MAX).map(r=>r.accountId))}>☑ Chọn tất cả đủ điều kiện</button>
    <button type="button" disabled={busy||!chosen.length} onClick={()=>setSelected([])}>Bỏ chọn</button>
    <button type="button" className={styles.deleteBulk} disabled={busy||!chosen.length} onClick={()=>{setError("");setOpen(true);}}>⌫ Xóa đã chọn</button>
    <button type="button" className={styles.deleteRevoked} disabled={busy||!rows.some(r=>r.accessStatus==="blocked"&&r.eligible)}
      onClick={()=>{setSelected(rows.filter(r=>r.accessStatus==="blocked"&&r.eligible).slice(0,MAX).map(r=>r.accountId));setError("");setOpen(true);}}>Xóa tất cả đã thu hồi đủ điều kiện</button>
   </div>
   {error?<p className={styles.error} role="alert">{error}</p>:null}
   {message?<p className={styles.success} role="status">{message}</p>:null}
   {scanned?<div className={styles.directGrid}>
    {visible.map(r=>{
     const state=r.accessStatus==="blocked"?"Đã thu hồi":r.accessStatus==="pending"?"Chờ xác nhận":"Đang hoạt động";
     const entitlement=durations.find(item=>item.accountId===r.accountId);
     return <article key={r.accountId} className={styles.directCard} data-status={r.accessStatus||"unknown"}>
      <div className={styles.cardTop}>
       <label className={styles.cardCheck} title={r.eligible?"Chọn tài khoản để xóa":"Tài khoản được bảo vệ"}>
        <input type="checkbox" aria-label={`Chọn xóa ${r.name}`} checked={selected.includes(r.accountId)}
         disabled={busy||!r.eligible||(!selected.includes(r.accountId)&&selected.length>=MAX)}
         onChange={e=>toggle(r.accountId,e.target.checked)}/>
       </label>
       <span className={styles.avatar} aria-hidden="true">{(r.name||"C").slice(0,1).toLocaleUpperCase("vi")}</span>
       <span className={styles.status} data-status={r.accessStatus||"unknown"}>{state}</span>
      </div>
      <strong className={styles.cardName}>{r.name||"Chưa khai báo"}</strong>
      <small className={styles.cardRole}>Cán bộ quản lý · {r.stage||"Hồ sơ chưa xác minh"}</small>
      <div className={styles.cardMeta}><span>Đăng ký</span><strong>{when(r.createdAt)}</strong></div>
      <div className={styles.cardMeta}><span>Phiên hiện tại</span><strong>{r.activeSessions??"—"}</strong></div>
      {onManage?<div className={styles.cardMeta}><span>Thời hạn sử dụng</span>
       <strong>{entitlement?.expiresAt==="9999-12-31T23:59:59.000Z"?"Không giới hạn":
        entitlement?.expiresAt?when(entitlement.expiresAt):"Chưa cấp"}</strong></div>:null}
      <div className={styles.cardMeta}><span>Trạng thái xóa</span><strong>{r.eligible?"Đủ điều kiện":"Được bảo vệ"}</strong></div>
      {!r.eligible?<small className={styles.blocker} title={r.blockers.join("; ")}>{r.blockers.join("; ")||"Không được phép xóa theo chính sách D1"}</small>:null}
      <footer className={styles.cardActions}>
       {onManage?<button type="button" onClick={()=>onManage(r.accountId)}>◷ Điều chỉnh</button>:null}
       <button type="button" disabled={busy||!r.eligible} className={styles.cardDelete}
        onClick={()=>{setSelected([r.accountId]);setError("");setOpen(true);}}>⌫ Xóa</button>
      </footer>
      <code title={r.accountId}>{r.accountId.slice(0,20)}…</code>
     </article>;
    })}
    {!visible.length?<p className={styles.empty}>Không có cán bộ phù hợp bộ lọc; hồ sơ được bảo vệ không tự biến mất.</p>:null}
   </div>:<p className={styles.empty} role="status">{busy?"Đang kiểm tra D1…":"Chưa có kết quả được xác minh; chọn Làm mới."}</p>}
   {nextCursor?<button type="button" className={styles.reload} disabled={busy} onClick={()=>void scan(nextCursor)}>Xem tiếp tối đa 100 tài khoản</button>:null}
   <p className={styles.footer}>Xóa trực tiếp nghĩa là chọn ngay trên thẻ; khi xác nhận vẫn phải qua Authenticator Owner, đối chiếu D1, CAS và nhật ký. Không tự động xóa tài khoản có dữ liệu.</p>
  </section>:<button ref={trigger} type="button" className={styles.launch}
    onClick={()=>{setOpen(true);setError("");setMessage("");void scan();}}>
   <span aria-hidden="true">♻</span>
   <span><strong>Thanh lọc cán bộ · Xóa D1</strong><small>Chọn nhiều, kiểm tra điều kiện và xóa vĩnh viễn</small></span>
  </button>}
  {open?<div className={styles.backdrop} role="presentation" onMouseDown={e=>{
    if(e.target===e.currentTarget&&!busy&&!authRequired)setOpen(false);
  }}>
    <section role="dialog" aria-modal="true" aria-label="Xóa vĩnh viễn tài khoản cán bộ" className={styles.dialog}>
     <header className={styles.header}>
      <div><small>OWNER · KIỂM TRA VÀ THANH LỌC D1</small>
       <h2>Xóa vĩnh viễn cán bộ quản lý</h2></div>
      <button type="button" aria-label="Đóng" disabled={busy} onClick={()=>setOpen(false)}>✕</button>
     </header>
     <div className={styles.body}>
      <p className={styles.notice}>Đây là <strong>xóa tài khoản khỏi D1</strong>, không phải “gỡ quyền & lưu trữ”.
       Chỉ tài khoản chưa kích hoạt hoặc đã khóa, không còn phiên hoạt động và không có dữ liệu
       học tập, chứng nhận, thanh toán, phân công mới được chọn. Tài khoản đang dùng được bảo vệ.</p>
      <div className={styles.toolbar}>
       <button type="button" disabled={busy} onClick={()=>void scan()}>↻ Quét lại D1 · Không xóa</button>
       <span>{scanned?"Đã kiểm tra "+rows.length+" cán bộ trong các trang đã tải":"Đang kiểm tra…"}</span>
      </div>
      {scanned?<div className={styles.summary}>
       <span>Đủ điều kiện <strong>{eligible.length}</strong></span>
       <span>Được bảo vệ <strong>{rows.length-eligible.length}</strong></span>
       <span>Đã chọn <strong>{chosen.length}</strong></span>
      </div>:null}
      {error?<p role="alert" className={styles.error}>{error}</p>:null}
      {message?<p role="status" className={styles.success}>{message}</p>:null}
      {scanned?<><div className={styles.selection}>
       <button type="button" disabled={busy||!eligible.length} onClick={()=>setSelected(eligible.slice(0,MAX).map(x=>x.accountId))}>
        Chọn tối đa {MAX} tài khoản đủ điều kiện
       </button>
       <button type="button" disabled={busy||!selected.length} onClick={()=>setSelected([])}>Bỏ chọn</button>
      </div>
      <div className={styles.list} role="group" aria-label="Cán bộ đã đối chiếu D1">
       {rows.map(row=><label key={row.accountId} className={styles.item} data-eligible={row.eligible}>
        <input type="checkbox" disabled={busy||!row.eligible||
         (!selected.includes(row.accountId)&&selected.length>=MAX)}
         checked={selected.includes(row.accountId)} onChange={e=>toggle(row.accountId,e.target.checked)}/>
        <span><strong>{row.name||"Chưa khai báo"}</strong>
         <small>{row.stage||"Chưa có trạng thái"} · {row.inactiveDays} ngày từ tín hiệu gần nhất</small>
         <small>Đăng ký: {when(row.createdAt)} · Hoạt động: {when(row.lastSeenAt)}</small>
         <code>{row.accountId}</code>
         {row.eligible?<em className={styles.eligible}>Đủ điều kiện xóa theo D1</em>
         :<em className={styles.protected}>Không được xóa: {row.blockers.length?row.blockers.join("; "):
          "Đang hoạt động hoặc trạng thái chưa cho phép"}</em>}
        </span></label>)}
       {!rows.length?<p>Không có hồ sơ quản lý trong tập dữ liệu đã quét.</p>:null}
      </div>
      {nextCursor?<button type="button" disabled={busy} onClick={()=>void scan(nextCursor)}>
        Tải thêm tối đa 100 hồ sơ
      </button>:null}</>:null}
      {chosen.length>0?<fieldset className={styles.danger} disabled={busy}>
       <legend>Xóa {chosen.length} tài khoản · Không thể khôi phục</legend>
       <label>Lý do và căn cứ loại bỏ<textarea value={reason} maxLength={300} rows={2}
         onChange={e=>setReason(e.target.value)}/></label>
       <label>Nhập chính xác XOA VINH VIEN CAN BO
        <input autoComplete="off" value={confirmation} onChange={e=>setConfirmation(e.target.value.toUpperCase())}/>
       </label>
       <button type="button" className={styles.purge} disabled={confirmation!=="XOA VINH VIEN CAN BO"||
        reason.trim().length<10} onClick={()=>void purge()}>
         {busy?"Đang đối chiếu D1…":"Xóa vĩnh viễn đã chọn · Owner"}
       </button>
      </fieldset>:null}
      <p className={styles.footer}>Lệnh xóa gửi riêng từng tài khoản, có kiểm tra snapshot/CAS ngay trên D1
       và đọc lại độc lập. Nếu xảy ra lỗi không chắc chắn, quá trình dừng, không tự xóa tiếp.
       Lịch sử kiểm toán được giữ dưới dạng mã băm, không giữ lại hồ sơ đăng nhập.</p>
     </div>
    </section>
   </div>:null}
   {authRequired?<AuthenticatorStepUp finish={finishAuth} setupRequired={authRequired==="setup"}/>:null}
 </>;
}
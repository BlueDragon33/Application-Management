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
export default function OwnerManagerPurgePanel({onChanged=()=>{},compact=false}:{
 onChanged?:()=>void;compact?:boolean;
}){
 const [open,setOpen]=useState(false);
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
  <button ref={trigger} type="button" className={styles.launch}
    onClick={()=>{setOpen(true);setError("");setMessage("");void scan();}}>
   <span aria-hidden="true">♻</span>
   <span><strong>Thanh lọc cán bộ · Xóa D1</strong><small>Chọn nhiều, kiểm tra điều kiện và xóa vĩnh viễn</small></span>
  </button>
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
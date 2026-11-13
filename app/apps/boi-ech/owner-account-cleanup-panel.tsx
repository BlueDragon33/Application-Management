"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import AuthenticatorStepUp from "../../authenticator-step-up";
import {previewOwnerAgedAccounts,purgeOwnerAgedAccount,
 type BoiCleanupMode,type BoiCleanupDays,type BoiCleanupPreview,
 type BoiCleanupRecord} from "../../boi-access-client";
import styles from "./owner-account-cleanup.module.css";
import OwnerLegacyBulkPanel from "./owner-legacy-bulk-panel";

const daysLabel:Record<BoiCleanupDays,string>={3:"Từ 3 ngày",5:"Từ 5 ngày",7:"Từ 7 ngày",8:"Hơn 7 ngày"};
const MAX_REMOVE=20;
const time=(value:string|null)=> {
 if(!value)return "Chưa có bản ghi";
 const d=new Date(value);
 return Number.isFinite(d.getTime())?new Intl.DateTimeFormat("vi-VN",{
  timeZone:"Asia/Ho_Chi_Minh",dateStyle:"short",timeStyle:"short"}).format(d)+" (VN)":"Không xác định";
};
export default function OwnerAccountCleanupPanel(){
 const [days,setDays]=useState<BoiCleanupDays>(7);
 const [mode,setMode]=useState<BoiCleanupMode>("pending");
 const [preview,setPreview]=useState<BoiCleanupPreview|null>(null);
 const [selected,setSelected]=useState<string[]>([]);
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
 const [reason,setReason]=useState("Owner xác nhận xóa hồ sơ không sử dụng, không có dữ liệu học tập");
 const [confirmation,setConfirmation]=useState("");
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 const [results,setResults]=useState({done:0,total:0});
 const [authRequired,setAuthRequired]=useState<"verify"|"setup"|null>(null);
 const authResolver=useRef<((ok:boolean)=>void)|null>(null);
 const mounted=useRef(true),operationLock=useRef(false);
 useEffect(()=>{
  mounted.current=true;return()=>{mounted.current=false;
   authResolver.current?.(false);authResolver.current=null;};
 },[]);
 const eligible=useMemo(()=>preview?.records.filter(r=>r.eligible)??[],[preview]);
 const blocked=useMemo(()=>preview?.records.filter(r=>!r.eligible)??[],[preview]);
 const selection=eligible.filter(r=>selected.includes(r.accountId));
 function reset(nextDays:BoiCleanupDays,nextMode:BoiCleanupMode){
  setDays(nextDays);setMode(nextMode);
  setPreview(null);setSelected([]);setConfirmation("");setError("");setMessage("");
  setResults({done:0,total:0});
 }
 async function load(cursor?:string){
  if(busy||loading)return;setLoading(true);setError("");setMessage("");
  try{
   const result=await previewOwnerAgedAccounts({days,mode,...(cursor?{cursor}:{})});
   if(!mounted.current)return;
   setPreview(result);setSelected([]);setConfirmation("");
  }catch(e){if(mounted.current){setPreview(null);setSelected([]);
   setError(e instanceof Error?e.message:"Không đọc được danh sách tài khoản từ D1.");}}
  finally{if(mounted.current)setLoading(false);}
 }
 function finishAuth(ok:boolean){
  setAuthRequired(null);authResolver.current?.(ok);authResolver.current=null;
 }
 async function withOwnerMfa<T,>(callback:()=>Promise<T>){
  try{return await callback();}
  catch(e){
   const d=e instanceof Error?(e as Error&{data?:Record<string,unknown>}).data:undefined;
   if(d?.code!=="STEP_UP_REQUIRED"||d.applied!==false||!mounted.current)throw e;
   setAuthRequired(d.authenticatorSetupRequired===true?"setup":"verify");
   const allowed=await new Promise<boolean>(resolve=>{authResolver.current=resolve;});
   if(!allowed||!mounted.current)throw new Error("Đã hủy Authenticator; chưa thực hiện xóa.");
   return callback(); // only the explicitly unapplied MFA denial is safe to retry
  }
 }
 async function removeSelection(){
  if(busy||operationLock.current||loading||!preview||!selection.length)return;
  if(confirmation!=="XOA TAI KHOAN"||reason.trim().length<10){setError("Nhập XOA TAI KHOAN và lý do ít nhất 10 ký tự.");return;}
  if(selection.length>MAX_REMOVE){setError("Chỉ xóa tối đa 20 tài khoản mỗi lượt.");return;}
  if(!window.confirm("Xóa vĩnh viễn "+selection.length+
     " tài khoản đã chọn khỏi D1? Không thể hoàn tác. Nhật ký kiểm toán được giữ lại."))return;
  operationLock.current=true;setBusy(true);setError("");setMessage("");
  setResults({done:0,total:selection.length});
  let done=0;
  try{
   for(const target of selection){
    await withOwnerMfa(()=>purgeOwnerAgedAccount({
     days,mode,accountId:target.accountId,snapshot:target.snapshot,reason:reason.trim()
    }));
    done+=1;if(mounted.current)setResults({done,total:selection.length});
   }
   if(mounted.current)setMessage("Đã xác minh xóa "+done+" tài khoản khỏi D1; bảo toàn nhật ký kiểm toán.");
  }catch(e){if(mounted.current)setError("Đã xác minh "+done+"/"+selection.length+
   " tài khoản. Đã dừng ngay ở lỗi tiếp theo; không tự gửi lại: "+
    (e instanceof Error?e.message:"Không xác minh được kết quả."));}
  finally{
   operationLock.current=false;if(mounted.current){setBusy(false);setConfirmation("");
    setSelected([]);setPreview(null);}
  }
 }
 const toggle=(id:string,yes:boolean)=>setSelected(values=>yes?
  [...values.filter(x=>x!==id),id].slice(0,MAX_REMOVE):values.filter(x=>x!==id));
 return <>
  <section className={styles.panel} inert={authRequired!==null} aria-hidden={authRequired!==null?true:undefined}
   aria-label="Lọc và xóa tài khoản lâu ngày không sử dụng">
   <header className={styles.title}>
    <div><span>OWNER · BẢO TRÌ DỮ LIỆU</span><h2>Thanh lọc tài khoản không sử dụng</h2></div>
    <p>Quét trực tiếp D1 theo mốc thời gian. Chỉ hồ sơ đủ điều kiện mới có thể chọn xóa.
      Không xóa tự động, không xóa tài khoản đang đăng nhập hoặc có chứng nhận, thanh toán, dữ liệu học tập.</p>
   </header>
   <div className={styles.options}>
    <fieldset disabled={loading||busy}>
     <legend>Thời gian không hoạt động</legend>
     <div className={styles.pills}>{([3,5,7,8] as BoiCleanupDays[]).map(d=>
      <button type="button" key={d} aria-pressed={days===d}
       className={days===d?styles.active:""} onClick={()=>reset(d,mode)}>{daysLabel[d]}</button>)}</div>
    </fieldset>
    <fieldset disabled={loading||busy}>
     <legend>Nhóm tài khoản</legend>
     <div className={styles.pills}>{([
      ["pending","Đăng ký lâu, chưa duyệt"],["inactive","Đã duyệt, lâu không hoạt động"],
      ["both","Cả hai nhóm"]
     ] as const).map(([key,name])=>
      <button type="button" key={key} aria-pressed={mode===key}
       className={mode===key?styles.active:""} onClick={()=>reset(days,key)}>{name}</button>)}</div>
    </fieldset>
   </div>
   <div className={styles.actions}><button type="button" disabled={loading||busy}
     onClick={()=>void load()}>{loading?"Đang quét D1…":"Quét thử · Không xóa"}</button>
    {preview?<span>Đã kiểm tra {preview.scanned} tài khoản trên trang hiện tại</span>:null}</div>
   {error?<p role="alert" className={styles.error}>{error}</p>:null}
   {message?<p role="status" className={styles.success}>{message}</p>:null}
   {preview?<div className={styles.results}>
    <div className={styles.summary}>
     <div><small>Đủ điều kiện</small><strong>{eligible.length}</strong></div>
     <div><small>Không được xóa</small><strong>{blocked.length}</strong></div>
     <div><small>Đã chọn</small><strong>{selection.length}</strong></div>
    </div>
    <p className={styles.explain}>Kết quả chỉ thuộc {preview.scanned} tài khoản đã quét trên trang này,
      không phải toàn hệ thống. Những tài khoản có tiến độ, lịch sử học hoặc hoạt động mới sẽ được bảo vệ.</p>
    <div className={styles.actions}>
     <button type="button" disabled={!eligible.length||busy}
      onClick={()=>setSelected(eligible.slice(0,MAX_REMOVE).map(r=>r.accountId))}>
      Chọn tối đa {MAX_REMOVE} hồ sơ đủ điều kiện</button>
     <button type="button" disabled={!selected.length||busy} onClick={()=>setSelected([])}>Bỏ chọn</button>
    </div>
    <div className={styles.list} role="group" aria-label="Kết quả sàng lọc tài khoản">
     {preview.records.map((r:BoiCleanupRecord)=><label key={r.accountId} className={styles.item}>
      <input type="checkbox" disabled={busy||!r.eligible||
       (!selected.includes(r.accountId)&&selection.length>=MAX_REMOVE)}
       checked={selected.includes(r.accountId)} onChange={e=>toggle(r.accountId,e.target.checked)}/>
      <span><strong>{r.name}</strong><small>{r.category==="pending"?"Chờ duyệt":"Đã duyệt, không hoạt động"}
       {" · "}{r.role||"Chưa khai báo"} · {r.inactiveDays} ngày</small>
       <code>{r.accountId}</code>
       <small>Đăng ký: {time(r.createdAt)} · Lần đăng nhập: {time(r.latestLoginAt)}
        {" · "}Tín hiệu gần nhất: {time(r.lastSeenAt)}</small>
       {!r.eligible?<em className={styles.protected}>Được bảo vệ: {r.blockers.join("; ")}</em>:null}
      </span>
     </label>)}
     {!preview.records.length?<p>Không tìm thấy hồ sơ phù hợp trong trang kết quả đã quét.</p>:null}
    </div>
    {preview.hasMore?<button type="button" disabled={loading||busy}
     onClick={()=>void load(preview.nextCursor||undefined)}>Quét trang kế tiếp</button>:null}
    {selection.length>0?<div className={styles.danger}>
     <strong>Xóa vĩnh viễn {selection.length} tài khoản đã chọn</strong>
     <p>Chỉ xóa hồ sơ đủ điều kiện và bản ghi liên quan; audit bất biến vẫn được lưu.
      Tài khoản đang dùng, có tiến độ, chứng nhận, thanh toán hoặc phân công sẽ bị loại trừ.</p>
     <label>Lý do (ít nhất 10 ký tự)<textarea value={reason} maxLength={300} rows={2}
      disabled={busy} onChange={e=>setReason(e.target.value)}/></label>
     <label>Gõ chính xác XOA TAI KHOAN<input value={confirmation} disabled={busy}
      autoComplete="off" onChange={e=>setConfirmation(e.target.value.toUpperCase())}/></label>
     <button type="button" disabled={busy||confirmation!=="XOA TAI KHOAN"||
      reason.trim().length<10} className={styles.delete}
      onClick={()=>void removeSelection()}>{busy?"Đang xử lý "+results.done+"/"+results.total+"…":
      "Xóa tài khoản đã chọn · Xác minh Owner"}</button>
     {busy?<p role="status">Đã xác minh {results.done}/{results.total}. Có thể hủy Authenticator,
       khi đó các lệnh chưa gửi sẽ không được thực hiện.</p>:null}
    </div>:null}
   </div>:null}
  </section>
  <OwnerLegacyBulkPanel/>
  {authRequired?<AuthenticatorStepUp finish={finishAuth} setupRequired={authRequired==="setup"}/>:null}
 </>;
}

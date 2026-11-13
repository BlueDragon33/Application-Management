"use client";
import {useEffect,useRef,useState} from "react";
import AuthenticatorStepUp from "../../authenticator-step-up";
import {previewOwnerLegacyFiveDayPurge,purgeOwnerLegacyFiveDayBatch,
 type BoiLegacyFiveDayPreview} from "../../boi-access-client";
import styles from "./owner-account-cleanup.module.css";
const CONFIRM="XOA TAI KHOAN CU TREN 5 NGAY";
export default function OwnerLegacyBulkPanel(){
 const [preview,setPreview]=useState<BoiLegacyFiveDayPreview|null>(null);
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
 const [reason,setReason]=useState("Dọn tài khoản học viên/giảng viên thuộc luồng Owner cũ, tạo quá 5 ngày");
 const [confirmation,setConfirmation]=useState("");
 const [message,setMessage]=useState(""),[error,setError]=useState("");
 const [progress,setProgress]=useState(0);
 const [authRequired,setAuthRequired]=useState<"verify"|"setup"|null>(null);
 const resolver=useRef<((ok:boolean)=>void)|null>(null);
 const lock=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;
  resolver.current?.(false);resolver.current=null;};},[]);
 const finish=(yes:boolean)=>{
  setAuthRequired(null);resolver.current?.(yes);resolver.current=null;
 };
 async function withMfa<T,>(operation:()=>Promise<T>):Promise<T>{
  try{return await operation();}
  catch(e){
   const meta=e instanceof Error?(e as Error&{data?:Record<string,unknown>}).data:undefined;
   if(meta?.code!=="STEP_UP_REQUIRED"||meta.applied!==false||!mounted.current)throw e;
   setAuthRequired(meta.authenticatorSetupRequired===true?"setup":"verify");
   const allowed=await new Promise<boolean>(resolve=>{resolver.current=resolve;});
   if(!allowed||!mounted.current)throw new Error("Owner hủy xác thực; không tiếp tục xóa.");
   return operation(); // only a verified, non-applied MFA denial is safely retryable
  }
 }
 async function scan(){
  if(busy||loading)return;setLoading(true);setError("");setMessage("");
  try{const p=await previewOwnerLegacyFiveDayPurge();
   if(mounted.current){setPreview(p);setProgress(0);setConfirmation("");}}
  catch(e){if(mounted.current){setPreview(null);
   setError(e instanceof Error?e.message:"Chưa đọc được D1.");}}
  finally{if(mounted.current)setLoading(false);}
 }
 async function purgeAll(){
  if(!preview||busy||loading||lock.current||!preview.eligible)return;
  if(confirmation!==CONFIRM||reason.trim().length<10){
   setError("Nhập đúng câu xác nhận và lý do ít nhất 10 ký tự.");return;
  }
  if(!window.confirm("Xóa vĩnh viễn "+preview.eligible+
   " tài khoản/thiết bị thuộc luồng duyệt cũ, tạo quá 5 ngày? Hành động không thể hoàn tác."))return;
  lock.current=true;setBusy(true);setMessage("");setError("");setProgress(0);
  let done=0,checked=preview;
  try{
   // Each protected D1 request removes max 10 identities atomically and readbacks.
   // Never retry an unknown mutation result or bypass the next preview snapshot.
   for(let batch=0;batch<50 && checked.eligible>0;batch++){
    const result=await withMfa(()=>purgeOwnerLegacyFiveDayBatch({
     snapshot:checked.snapshot,reason:reason.trim()}));
    if(result.applied!==true||result.deleted<1||result.deleted>10)
     throw new Error("D1 chưa xác nhận một lô xóa; dừng và đối chiếu lại.");
    done+=result.deleted;
    if(mounted.current)setProgress(done);
    checked=await previewOwnerLegacyFiveDayPurge();
    if(result.remaining!==checked.eligible)
     throw new Error("Số lượng sau xóa không khớp. Không gửi lô kế tiếp.");
   }
   if(checked.eligible>0)throw new Error("Đã đạt giới hạn 500 tài khoản mỗi lần. Phải kiểm tra lại trước đợt tiếp.");
   if(mounted.current){
    setPreview(checked);
    setMessage("Đã đọc lại D1 và xác nhận xóa "+done+
     " hồ sơ cũ. Nhật ký kiểm toán được giữ. Hồ sơ có dữ liệu cần bảo vệ không bị xóa.");
   }
  }catch(e){if(mounted.current){
   setPreview(null);
   setError("Đã xác minh "+done+" tài khoản được xóa. Đã dừng ngay; không tự gửi lại lệnh. "+
    (e instanceof Error?e.message:"Không xác minh được kết quả."));}}
  finally{lock.current=false;if(mounted.current){setBusy(false);setConfirmation("");}}
 }
 return <>
  <section className={styles.panel} inert={authRequired!==null}
   aria-hidden={authRequired!==null?true:undefined}
   aria-label="Owner dọn tài khoản học viên và giảng viên cũ hơn năm ngày">
   <header className={styles.title}>
    <div><span>OWNER · TÀI KHOẢN CŨ</span><h2>Xóa tài khoản cũ quá 5 ngày</h2></div>
    <p>Chỉ hồ sơ học viên, giảng viên từng được luồng Quản trị Bơi Ếch cũ duyệt.
     Không xóa cán bộ quản lý, hồ sơ cán bộ đã phân công hoặc tài khoản đăng nhập thế hệ mới.
     Thời gian tính từ lúc thiết bị gốc được tạo trên D1, đủ 5 ngày tròn.</p>
   </header>
   <div className={styles.actions}>
    <button type="button" disabled={busy||loading} onClick={()=>void scan()}>
     {loading?"Đang đối chiếu D1…":"Kiểm kê tài khoản cũ · Không xóa"}</button>
   </div>
   {error?<p className={styles.error} role="alert">{error}</p>:null}
   {message?<p className={styles.success} role="status">{message}</p>:null}
   {preview?<div className={styles.results}>
    <div className={styles.summary}>
     <div><small>Tổng hồ sơ cũ có bằng chứng</small><strong>{preview.totalMatched}</strong></div>
     <div><small>Được xóa an toàn</small><strong>{preview.eligible}</strong></div>
     <div><small>Cần bảo vệ/đối chiếu</small><strong>{preview.protected}</strong></div>
    </div>
    <p className={styles.explain}>
     Hồ sơ có thanh toán: {preview.protectedByReason.payment};
     có chứng chỉ: {preview.protectedByReason.certificate};
     có lịch đào tạo: {preview.protectedByReason.training};
     có nội dung giảng dạy: {preview.protectedByReason.authoredContent};
     hồ sơ học tập gốc dùng chung: {preview.protectedByReason.sharedLegacyProfiles??0}.
     Đây là số liệu từ D1, không phải tổng số người dùng của hệ thống mới.</p>
    {preview.eligible>0?<div className={styles.danger}>
     <strong>Xóa theo lô tối đa 10 tài khoản/giao dịch</strong>
     <p>Mỗi giao dịch xác nhận trạng thái và quyền Owner, thực hiện trong D1 rồi đọc lại.
      Tự dừng nếu dữ liệu thay đổi hoặc xác minh thất bại. Nhật ký audit được giữ.</p>
     <label>Lý do xóa<input value={reason} maxLength={300} disabled={busy}
      onChange={e=>setReason(e.target.value)}/></label>
     <label>Gõ chính xác {CONFIRM}<input value={confirmation}
      autoComplete="off" disabled={busy} onChange={e=>setConfirmation(e.target.value.toUpperCase())}/></label>
     <button type="button" className={styles.delete}
      disabled={busy||confirmation!==CONFIRM||reason.trim().length<10}
      onClick={()=>void purgeAll()}>
      {busy?"Đang xác minh và xóa…":"Xóa toàn bộ hồ sơ cũ đủ điều kiện"}</button>
     {busy?<p role="status">Đã xác minh xóa {progress} tài khoản; nếu kết quả không rõ sẽ dừng ngay.</p>:null}
    </div>:<p>Không có tài khoản cũ đủ điều kiện xóa an toàn tại thời điểm quét.</p>}
   </div>:null}
  </section>
  {authRequired?<AuthenticatorStepUp finish={finish} setupRequired={authRequired==="setup"}/>:null}
 </>;
}

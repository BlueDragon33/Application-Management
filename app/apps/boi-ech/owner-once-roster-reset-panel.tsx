"use client";
import {useEffect,useRef,useState} from "react";
import AuthenticatorStepUp from "../../authenticator-step-up";
import {previewOwnerOnceRosterReset,executeOwnerOnceRosterBatch,
 type BoiOnceRosterPreview} from "../../boi-access-client";
import styles from "./owner-account-cleanup.module.css";
const CONFIRM="XOA TAT CA TRU THIEN SON VA DONG NGHI";
const BOOKMARK=/^([a-f0-9]{8}-){3}[a-f0-9]{32}$/i;
export default function OwnerOnceRosterResetPanel(){
 const [preview,setPreview]=useState<BoiOnceRosterPreview|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [reason,setReason]=useState("Đợt một lần xóa tất cả học viên/giảng viên trừ Ngô Tuyết Quỳnh, Thiên Sơn và Đông Nghi");
 const [bookmark,setBookmark]=useState("");
 const [confirmation,setConfirmation]=useState("");
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [removed,setRemoved]=useState(0);
 const [authRequired,setAuthRequired]=useState<"verify"|"setup"|null>(null);
 const resolveAuth=useRef<((yes:boolean)=>void)|null>(null);
 const lock=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;
  resolveAuth.current?.(false);resolveAuth.current=null;};},[]);
 const finish=(yes:boolean)=>{setAuthRequired(null);resolveAuth.current?.(yes);
  resolveAuth.current=null;};
 async function withMfa<T,>(op:()=>Promise<T>):Promise<T>{
  try{return await op();}
  catch(e){
   const data=e instanceof Error?(e as Error&{data?:Record<string,unknown>}).data:undefined;
   if(data?.code!=="STEP_UP_REQUIRED"||data.applied!==false||!mounted.current)throw e;
   setAuthRequired(data.authenticatorSetupRequired===true?"setup":"verify");
   const verified=await new Promise<boolean>(resolve=>{resolveAuth.current=resolve;});
   if(!verified||!mounted.current)throw new Error("Owner chưa xác minh MFA; dừng thao tác.");
   return op(); // Only explicit non-applied MFA denial can be retried.
  }
 }
 async function scan(){
  if(lock.current||loading)return;setLoading(true);setError("");setNotice("");
  try{
   const value=await previewOwnerOnceRosterReset();
   if(mounted.current){setPreview(value);setConfirmation("");setRemoved(value.removedInSession);}
  }catch(e){
   if(mounted.current){setPreview(null);
    setError("Không thể đối chiếu duy nhất Thiên Sơn và Đông Nghi trên D1 hoặc dữ liệu chưa sẵn sàng. "+
     (e instanceof Error?e.message:"Không xác minh được."));}
  }finally{if(mounted.current)setLoading(false);}
 }
 async function purge(){
  if(!preview||busy||loading||lock.current||preview.eligible===0||
   preview.state==="completed"||preview.state==="retention_review")return;
  if(confirmation!==CONFIRM||reason.trim().length<10||!BOOKMARK.test(bookmark.trim())){
   setError("Cần nhập đúng câu xác nhận, lý do và mốc khôi phục D1 PITR hợp lệ.");return;
  }
  const son=preview.protectedPeople[0],nghi=preview.protectedPeople[1],quynh=preview.protectedPeople[2];
  if(!window.confirm("Xác nhận GIỮ NGUYÊN: "+son.name+" ("+son.deviceId.slice(0,16)+
   "…), "+nghi.name+" ("+nghi.deviceId.slice(0,16)+
   "…), "+quynh.name+" ("+quynh.deviceId.slice(0,16)+
   "…). XÓA VĨNH VIỄN "+preview.eligible+
   " tài khoản học viên/giảng viên đủ điều kiện? Hoạt động này không thể hoàn tác nếu không có backup."))return;
  lock.current=true;setBusy(true);setError("");setNotice("");
  let current=preview;let deleted=0;
  try{
   for(let index=0;index<50&&current.eligible>0;index++){
    const next=await withMfa(()=>executeOwnerOnceRosterBatch({
     cutoff:current.cutoff,snapshot:current.snapshot,
     protectSon:current.protectedPeople[0].deviceId,
     protectNghi:current.protectedPeople[1].deviceId,
     protectQuynh:current.protectedPeople[2].deviceId,
     backupBookmark:bookmark.trim(),reason:reason.trim()}));
    if(next.deleted<1||next.deleted>10||next.protectedCount!==3||next.readback!==true)
     throw new Error("Lô D1 chưa xác minh kết quả, bắt buộc dừng.");
    deleted+=next.deleted;
    if(mounted.current)setRemoved(next.totalDeleted);
    current=await previewOwnerOnceRosterReset();
    if(next.remaining!==current.eligible)
     throw new Error("Số dư D1 sau xóa không khớp; không gửi lô kế tiếp.");
    if(current.state==="completed"||current.state==="retention_review")break;
   }
   if(current.eligible>0)throw new Error("Còn hồ sơ chưa được xử lý sau giới hạn 500.");
   if(mounted.current){
    setPreview(current);setNotice("D1 xác nhận xóa thêm "+deleted+" tài khoản. Tổng đợt: "+
     current.removedInSession+". Ba tài khoản Quỳnh, Thiên Sơn, Đông Nghi còn nguyên. "+
     (current.retainedForReview?"Còn "+current.retainedForReview+
       " tài khoản có thanh toán/chứng chỉ/lịch học/nội dung phải kiểm tra riêng.":
       "Không còn tài khoản đủ điều kiện trong danh sách của đợt một lần."));
   }
  }catch(e){if(mounted.current){
   setPreview(null);setError("Đã xác minh xóa "+deleted+
    " tài khoản trong lượt này. Dừng ngay, KHÔNG lặp lại khi kết quả chưa rõ. "+
    (e instanceof Error?e.message:"Lỗi xác minh D1."));}}
  finally{lock.current=false;if(mounted.current){setBusy(false);setConfirmation("");}}
 }
 const frozen=Boolean(preview&&["completed","retention_review"].includes(preview.state));
 return <>
  <section className={styles.panel} aria-label="Đợt xóa một lần học viên giảng viên, giữ Thiên Sơn và Đông Nghi"
   inert={authRequired!==null} aria-hidden={authRequired!==null?true:undefined}>
   <header className={styles.title}><span>OWNER · DỌN TÀI KHOẢN MỘT LẦN</span>
    <h2>Xóa học viên và giảng viên · Giữ đúng 3 người</h2>
    <p>Chỉ áp dụng một lần, không giới hạn tài khoản trên 5 ngày. Không đụng tài khoản cán bộ quản lý.
     Bắt buộc xác minh duy nhất Thiên Sơn và Đông Nghi từ D1 trước khi được phép xóa.
     Hồ sơ có chứng chỉ, lịch học, thanh toán hoặc nội dung dùng chung sẽ tạm giữ để rà soát.</p>
   </header>
   <div className={styles.actions}><button type="button" disabled={loading||busy}
     onClick={()=>void scan()}>{loading?"Đang xác minh D1…":"Quét D1 và khóa ba ngoại lệ · Không xóa"}</button></div>
   {error?<p role="alert" className={styles.error}>{error}</p>:null}
   {notice?<p role="status" className={styles.success}>{notice}</p>:null}
   {preview?<div className={styles.results}>
    <div className={styles.summary}>
     <div><small>Học viên/giảng viên thuộc đợt</small><strong>{preview.totalLearnersTeachers}</strong></div>
     <div><small>Có thể xóa</small><strong>{preview.eligible}</strong></div>
     <div><small>Phải giữ lại để kiểm toán</small><strong>{preview.retainedForReview}</strong></div>
    </div>
    <div className={styles.list} aria-label="Ba tài khoản tuyệt đối không được xóa">
     {preview.protectedPeople.map(person=><div className={styles.item} key={person.deviceId}>
      <span><strong>GIỮ NGUYÊN · {person.name}</strong>
       <small>Vai trò: {person.role==="teacher"?"Giảng viên":"Học viên"}</small>
       <code>Thiết bị gốc: {person.deviceId} · Tài khoản: {person.accountId??"Legacy"}</code>
      </span></div>)}
    </div>
    <p className={styles.explain}>Trạng thái đợt: {preview.state} · Đã xóa trước đó: {preview.removedInSession}.
     Thanh toán: {preview.blockers.payment}; chứng chỉ: {preview.blockers.certificates};
     lịch đào tạo: {preview.blockers.training}; nội dung: {preview.blockers.authoredContent};
     hồ sơ dùng chung: {preview.blockers.sharedLegacy}.
     Chỉ tiếp tục khi bản sao D1 PITR đã được kiểm chứng.</p>
    {preview.eligible>0&&!frozen?<div className={styles.danger}>
      <strong>Thao tác không thể hoàn tác nếu không có bản sao khôi phục D1</strong>
      <p>Chạy <code>npx wrangler d1 time-travel info boi-ech-db --json --config wrangler.d1.jsonc</code>
       với đúng tài khoản Cloudflare Production, kiểm tra khả năng khôi phục và nhập bookmark bên dưới.
       Đây là bằng chứng do Owner cung cấp, ứng dụng không tự xác minh Cloudflare backup.</p>
      <label>Mốc PITR D1 đã kiểm chứng<input value={bookmark} disabled={busy} autoComplete="off"
       onChange={e=>setBookmark(e.target.value.trim())} placeholder="xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"/></label>
      <label>Lý do thực hiện<input value={reason} disabled={busy} maxLength={300}
       onChange={e=>setReason(e.target.value)}/></label>
      <label>Gõ đúng {CONFIRM}<input value={confirmation} disabled={busy} autoComplete="off"
       onChange={e=>setConfirmation(e.target.value.toUpperCase())}/></label>
      <button type="button" className={styles.delete} disabled={busy||confirmation!==CONFIRM||
       !BOOKMARK.test(bookmark.trim())||reason.trim().length<10} onClick={()=>void purge()}>
       {busy?"Đang xóa từng lô và kiểm tra lại…":"Xóa một lần · Giữ Thiên Sơn và Đông Nghi"}</button>
      {busy?<p role="status">Đã xác minh xóa {removed} tài khoản; mỗi lô tối đa 10 và có CAS.</p>:null}
     </div>:<p role="status">{frozen?"Đợt đã kết thúc. Không được chạy lại.":
      "Không có hồ sơ đủ điều kiện xóa, dữ liệu vẫn được giữ nguyên."}</p>}
   </div>:null}
  </section>
  {authRequired?<AuthenticatorStepUp finish={finish} setupRequired={authRequired==="setup"}/>:null}
 </>;
}

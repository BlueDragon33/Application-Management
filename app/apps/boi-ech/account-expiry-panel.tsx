"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import AuthenticatorStepUp from "../../authenticator-step-up";
import OwnerAccountCleanupPanel from "./owner-account-cleanup-panel";
import OwnerOnceRosterResetPanel from "./owner-once-roster-reset-panel";
import AccountCapacityPanel from "./account-capacity-panel";
import OwnerAccountBlockPanel from "./owner-account-block-panel";
import {
 loadBoiAccountDurations,loadBoiManagerInbox,issueBoiManagerInvitation,
 changeBoiAccountDuration,changeBoiDefaultAccountDays,cancelBoiLocalTestManager,archiveBoiManagerAccount,
 type BoiAccountDurationRecord,type BoiAccountDurationPolicy,type BoiManagerInboxRecord
} from "../../boi-access-client";

const labels:Record<string,string>={manager:"Cán bộ quản lý",teacher:"Giảng viên",learner:"Học viên"};
const singleReview = process.env.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW === "true";
const FOUR_DAYS_MS=4*24*60*60*1000;
function agedManager(m:BoiManagerInboxRecord,now:number){
 const created=Date.parse(m.createdAt);
 return m.status==="pending" && m.activeSessions===0 &&
   ["requested","profile_required","profile_review","changes_requested"].includes(m.onboardingStage)
   && Number.isFinite(created) && now-created>FOUR_DAYS_MS;
}
function managerAccessLabel(m:BoiManagerInboxRecord){
 if(m.status==="blocked")return "Đã gỡ quyền";
 if(m.status==="approved"&&m.onboardingStage==="active")return "Đã hoàn thiện · Đã kích hoạt";
 if(m.onboardingStage==="active")return "Đã hoàn thiện · Đang đồng bộ quyền";
 if(m.status==="approved")return "Đã cấp quyền · Cần đối chiếu hồ sơ";
 return m.onboardingStage==="profile_required"?"Đã duyệt · Chờ hồ sơ":
 m.onboardingStage==="requested"?"Chờ hoàn thiện hồ sơ":"Chờ xử lý";
}
function moscow(value:string|null|undefined) {
 if(!value)return "Chưa cấp";
 if(value.startsWith("9999-"))return "Vĩnh viễn";
 const date=new Date(value);
 return Number.isFinite(date.getTime())?new Intl.DateTimeFormat("vi-VN",{
  timeZone:"Europe/Moscow",dateStyle:"short",timeStyle:"short"
 }).format(date)+" (Moscow)":"Không hợp lệ";
}
function remainingLabel(value:string|null|undefined,now:number){
 if(!value)return "Chưa được cấp";
 if(value.startsWith("9999-"))return "Vĩnh viễn";
 const days=Math.ceil((Date.parse(value)-now)/86400000);
 if(!Number.isFinite(days))return "Chưa xác minh";
 if(days<=0)return "Đã hết hạn";
 return days>=365?Math.floor(days/365)+" năm "+Math.floor(days%365/30)+" tháng":
  days>=30?Math.floor(days/30)+" tháng "+days%30+" ngày":days+" ngày";
}
function localInput(value:string) {
 const d=new Date(value);if(!Number.isFinite(d.getTime()))return "";
 // datetime-local uses wall clock; consistently show Moscow time (UTC+03 year-round).
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Moscow",
  year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d);
 const fields=Object.fromEntries(parts.filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
 return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`;
}
export default function AccountExpiryPanel({section="accounts"}:{section?:"accounts"|"oversight"|"policies"}){
 const [accounts,setAccounts]=useState<BoiAccountDurationRecord[]>([]);
 const [managerInbox,setManagerInbox]=useState<BoiManagerInboxRecord[]|null>(null);
 const [managerError,setManagerError]=useState(""),[managerLoading,setManagerLoading]=useState(false);
 const [managerNext,setManagerNext]=useState<string|null>(null);
 const [managerNotice,setManagerNotice]=useState(""),[inviteUrl,setInviteUrl]=useState("");
 const [managerWriting,setManagerWriting]=useState(false);
 const [managerFilter,setManagerFilter]=useState<"current"|"stale"|"archived"|"all">("current");
 const [managerSearch,setManagerSearch]=useState("");
 const [archiveTarget,setArchiveTarget]=useState<BoiManagerInboxRecord|null>(null);
 const [archiveConfirm,setArchiveConfirm]=useState("");
 const [archiveReason,setArchiveReason]=useState("Hồ sơ cán bộ cũ không còn sử dụng");
 const [localMode,setLocalMode]=useState(false);
 const [policies,setPolicies]=useState<BoiAccountDurationPolicy[]>([]);
 const [selected,setSelected]=useState("");
 const [search,setSearch]=useState("");
 const [roleDays,setRoleDays]=useState<Record<string,string>>({});
 const [expiration,setExpiration]=useState("");
 const [preset,setPreset]=useState<"7d"|"30d"|"6m"|"1y"|"4y"|"forever">("30d");
 const [reason,setReason]=useState("Owner quản lý thời hạn sử dụng");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [accountsVerified,setAccountsVerified]=useState(false);
 const [authenticate,setAuthenticate]=useState<"setup"|"verify"|null>(null);
 const authResolve=useRef<((verified:boolean)=>void)|null>(null);
 const mounted=useRef(true),writeLock=useRef(false);
 useEffect(()=>{
  mounted.current=true;
  return()=>{mounted.current=false;authResolve.current?.(false);authResolve.current=null;};
 },[]);
 function finishAuthentication(verified:boolean){
  setAuthenticate(null);authResolve.current?.(verified);authResolve.current=null;
 }
 async function withOwnerAuthentication<T,>(operation:()=>Promise<T>):Promise<T>{
  try{return await operation();}
  catch(caught){
   const data=caught instanceof Error?(caught as Error&{data?:Record<string,unknown>}).data:undefined;
   if(data?.code!=="STEP_UP_REQUIRED"||data.applied!==false||!mounted.current)throw caught;
   setAuthenticate(data.authenticatorSetupRequired===true?"setup":"verify");
   const allowed=await new Promise<boolean>(resolve=>{authResolve.current=resolve;});
   if(!allowed||!mounted.current)throw new Error("Đã hủy xác minh; bản nháp được giữ nguyên.");
   return operation();
  }
 }
 const [observedNow,setObservedNow]=useState(()=>Date.now());
 const current=accounts.find(a=>a.accountId===selected)??null;
 const visibleManagers=useMemo(()=> (managerInbox??[]).filter(m=>{
  const stale=agedManager(m,observedNow);
  if(managerFilter==="current"&&(stale||m.status==="blocked"))return false;
  if(managerFilter==="stale"&&!stale)return false;
  if(managerFilter==="archived"&&m.status!=="blocked")return false;
  return [m.name,m.accountId,m.status].join(" ").toLocaleLowerCase("vi")
   .includes(managerSearch.trim().toLocaleLowerCase("vi"));
 }),[managerInbox,managerFilter,managerSearch,observedNow]);
 const displayed=useMemo(()=>accounts.filter(a=>(section==="oversight" ? ["teacher","learner"].includes(a.role)
  : section==="policies" ? a.role==="manager" : false)
  && [a.accountId,a.name,a.role].join(" ").toLowerCase().includes(search.toLowerCase())).slice(0,100),[accounts,search,section]);
 const refreshManagerInbox=useCallback(async(after="")=>{
  setManagerLoading(true);setManagerError("");
  try{
   const result=await loadBoiManagerInbox(after);
   setManagerInbox(current=>after && current
    ? [...current.filter(a=>!result.managers.some(b=>b.accountId===a.accountId)),...result.managers]
    : result.managers);
   setManagerNext(result.nextCursor);
  }
  catch(e){
   setManagerInbox(null);setManagerNext(null);
   setManagerError(e instanceof Error?e.message:"Chưa tải được hàng chờ quản lý.");
  }finally{setManagerLoading(false);}
 },[]);
 async function createManagerInvitation(){
  if(managerWriting||writeLock.current||managerLoading||!singleReview||Boolean(managerError)||managerInbox===null)return;
  if(!window.confirm("Tạo mã mời dùng một lần cho Cán bộ quản lý? Chỉ gửi link cho đúng người; Owner không nhập mật khẩu hộ."))return;
  writeLock.current=true;setManagerWriting(true);setManagerError("");setManagerNotice("");setInviteUrl("");
  try{
   const invite=await withOwnerAuthentication(()=>issueBoiManagerInvitation());
   setInviteUrl(invite.inviteUrl);
   setManagerNotice("Đã xác minh cấp mã mời dùng một lần, hiệu lực đến "+moscow(invite.expiresAt)+". Sao chép liên kết và gửi riêng cho người nhận.");
  }catch(e){setManagerError(e instanceof Error?e.message:"Chưa xác minh được thư mời.");}
  finally{writeLock.current=false;setManagerWriting(false);}
 }
 async function cancelManagerTest(m:BoiManagerInboxRecord){
  if(managerWriting||writeLock.current||!localMode||!singleReview||!["requested","profile_required"].includes(m.onboardingStage))return;
  const typed=window.prompt("Hủy hồ sơ thử nghiệm? Gõ chính xác HUY HO SO để xác nhận.","");
  if(typed!=="HUY HO SO")return;
  if(!window.confirm("Xác nhận hủy hồ sơ ID "+m.accountId.slice(0,20)+"…? Mã mời cũ sẽ hết hiệu lực. Đăng ký lại cần thư mời mới."))return;
  writeLock.current=true;setManagerWriting(true);setManagerError("");setManagerNotice("");
  try{
   const result=await withOwnerAuthentication(()=>cancelBoiLocalTestManager(m.accountId,m.onboardingRevision));
   setManagerNotice("Đã hủy hồ sơ thử nghiệm ở D1 local; audit #"+result.auditId+". Tạo lời mời mới để đăng ký lại.");
   await refreshManagerInbox();
  }catch(e){setManagerError(e instanceof Error?e.message:"Không xác minh được hủy hồ sơ.");}
  finally{writeLock.current=false;setManagerWriting(false);}
 }
 async function confirmArchiveManager(){
  const m=archiveTarget;
  if(!m||managerWriting||writeLock.current||m.status==="blocked"
    ||archiveConfirm!=="LUU TRU"||archiveReason.trim().length<10)return;
  writeLock.current=true;setManagerWriting(true);setManagerError("");setManagerNotice("");
  try{
   await withOwnerAuthentication(()=>archiveBoiManagerAccount(
     m.accountId,m.accountRevision,archiveReason.trim()));
   setArchiveTarget(null);setArchiveConfirm("");
   setManagerNotice("Đã gỡ quyền, thu hồi các phiên đăng nhập và lưu trữ tài khoản. Hồ sơ lịch sử vẫn được giữ an toàn.");
   await refreshManagerInbox();
  }catch(e){setManagerError(e instanceof Error?e.message:"Không xác minh được lưu trữ cán bộ.");}
  finally{writeLock.current=false;setManagerWriting(false);}
 }
 async function refresh(){
  setLoading(true);setError("");setAccountsVerified(false);
  try {
   const next=await loadBoiAccountDurations();
   setAccounts(next.accounts);setPolicies(next.policies);setAccountsVerified(true);
   setRoleDays(Object.fromEntries(next.policies.map(p=>[p.role,String(p.defaultDays)])));
   setSelected(s=>next.accounts.some(a=>a.accountId===s)?s:"");
   setObservedNow(Date.now());
  }catch(e){
   setAccounts([]);setPolicies([]);setSelected("");setAccountsVerified(false);
   setError(e instanceof Error?e.message:"Không tải được tài khoản.");
  }finally{setLoading(false);}
 }
 useEffect(()=>{if(section!=="accounts")queueMicrotask(()=>{void refresh();});},[section]);
 useEffect(()=>{queueMicrotask(()=>setLocalMode(["localhost","127.0.0.1"].includes(window.location.hostname)));},[]);
 useEffect(()=>{if(section==="accounts")queueMicrotask(()=>{void refreshManagerInbox();});},[section,refreshManagerInbox]);
 // Resynchronize from the canonical BOI D1 after a profile is activated.
 useEffect(()=>{
  if(section!=="accounts")return;
  const resync=()=>{if(document.visibilityState==="visible"&&!writeLock.current)
   void refreshManagerInbox();};
  const interval=window.setInterval(resync,20000);
  document.addEventListener("visibilitychange",resync);
  return()=>{window.clearInterval(interval);document.removeEventListener("visibilitychange",resync);};
 },[section,refreshManagerInbox]);
 const currentExpiry=current?.entitlement?.expiresAt ?? null;
 useEffect(()=>{
  const next=currentExpiry?localInput(currentExpiry):"";
  queueMicrotask(()=>setExpiration(next));
 },[selected,currentExpiry]);
 async function commitAccount(operation:"set-expiry"|"set-preset"|"suspend"|"resume"){
  if(!current?.entitlement||current.role!=="manager"||busy||writeLock.current)return;
  if(reason.trim().length<5){setError("Nhập lý do dài ít nhất 5 ký tự.");return;}
  const parsed=Date.parse(expiration?expiration+":00+03:00":"");
  const iso=operation==="set-expiry"&&Number.isFinite(parsed)?new Date(parsed).toISOString():"";
  if(operation==="set-expiry"&&!iso){setError("Chọn ngày hết hạn hợp lệ.");return;}
  if(!window.confirm(`${operation==="set-preset"?"ĐẶT LẠI hạn "+preset+" từ hôm nay, không cộng dồn":operation==="set-expiry"?"Đổi ngày hết hạn":operation==="suspend"?"Tạm khóa":"Khôi phục"} tài khoản ${current.name||current.accountId}?`))return;
  writeLock.current=true;setBusy(true);setError("");setNotice("");
  try{
   await withOwnerAuthentication(()=>changeBoiAccountDuration({accountId:current.accountId,expectedRevision:current.entitlement!.revision,
    operation,...(operation==="set-expiry"?{expiresAt:iso}:{}),...(operation==="set-preset"?{period:preset}:{}),reason:reason.trim()}));
   setNotice("Đã lưu và đọc lại hạn tài khoản. Quyền thiết bị và thanh toán vẫn được kiểm soát riêng.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Không xác minh được thay đổi.");}
  finally{writeLock.current=false;setBusy(false);}
 }
 async function commitPolicy(p:BoiAccountDurationPolicy){
  if(busy||writeLock.current)return;const days=Number(roleDays[p.role]);
  if(!Number.isInteger(days)||days<1||days>365){setError("Mặc định phải từ 1–365 ngày.");return;}
  writeLock.current=true;setBusy(true);setError("");setNotice("");
  try{
   await withOwnerAuthentication(()=>changeBoiDefaultAccountDays({role:p.role,defaultDays:days,expectedRevision:p.revision,reason:reason.trim()}));
   setNotice("Đã cập nhật mặc định và đọc lại từ D1. Tài khoản đang dùng không bị đổi hạn tự động.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Không cập nhật được mặc định.");}
  finally{writeLock.current=false;setBusy(false);}
 }
 return <><section inert={authenticate!==null||archiveTarget!==null} aria-hidden={authenticate!==null||archiveTarget!==null?true:undefined} aria-label="Hồ sơ tài khoản Bơi ếch AI" className="boi-account-panel" data-section={section}>
  {section==="accounts"?<div className="boi-account-header"><span>OWNER · QUẢN LÝ CÁN BỘ</span><h2>Tài khoản cán bộ quản lý</h2><p>Danh sách đã đăng ký, phiên đăng nhập và hồ sơ đang hoàn thiện. Owner cấp lời mời cán bộ quản lý; tài khoản được kích hoạt tự động sau khi hoàn tất hồ sơ.</p></div>:null}
  {section==="oversight"?<div className="boi-account-header"><span>GIÁM SÁT · CHỈ ĐỌC</span><h2>Giảng viên & học viên</h2><p>Hiển thị thông tin, vai trò, trạng thái hồ sơ và thời hạn để giám sát. Không duyệt, từ chối, cấp hoặc thu hồi quyền từ đây.</p></div>:null}
  {section==="policies"?<div className="boi-account-header"><span>OWNER · QUẢN TRỊ CHÍNH SÁCH</span><h2>Thời hạn & chính sách</h2><p>Thiết lập mặc định chung không phải phê duyệt tài khoản. Chỉ điều chỉnh trực tiếp tài khoản cán bộ quản lý tại màn hình này.</p></div>:null}
  {section==="accounts"?<>
  <details className="boi-manager-inbox" open>
   <summary><strong>Hồ sơ Cán bộ quản lý · Tự kích hoạt</strong></summary>
   {!singleReview?<p role="alert" className="boi-manager-blocked">Chưa xác minh cấu hình duyệt một lần khớp Bơi Ếch. Chỉ xem hồ sơ; không tạo lời mời hoặc phát lệnh duyệt cũ.</p>:null}
   <p>Hồ sơ quản lý thuộc Bơi ếch, kiểm soát tập trung từ giao diện Owner này. Mã mời có hiệu lực 24 giờ,
    dùng một lần; người nhận tự đặt mật khẩu và khóa P-256 trên đúng trang Bơi ếch.</p>
   <div className="boi-manager-actions">
    <button type="button" disabled={managerLoading||managerWriting}
     onClick={()=>void refreshManagerInbox()}>Đồng bộ hàng chờ</button>
    <button type="button" disabled={managerWriting||managerLoading||!singleReview||Boolean(managerError)||managerInbox===null}
     onClick={()=>void createManagerInvitation()}>Tạo lời mời Cán bộ quản lý · MFA</button>
   </div>
   {managerNotice?<p role="status">{managerNotice}</p>:null}
   {managerError?<p role="alert">{managerError} Không suy diễn hàng chờ trống hoặc tự gửi lại lệnh.</p>:null}
   {inviteUrl?<div>
    <label>Liên kết một lần — chỉ gửi riêng, không đăng công khai
     <input type="text" readOnly value={inviteUrl} autoComplete="off" aria-label="Link mời quản lý" />
    </label>
    <button type="button" onClick={()=>void navigator.clipboard.writeText(inviteUrl)}>
     Sao chép link mời</button>
    <button type="button" onClick={()=>setInviteUrl("")}>Đã lưu — Ẩn mã mời</button>
   </div>:null}
   {managerInbox!==null?<div role="status" className="boi-manager-results">
    <div className="boi-manager-summary" aria-label="Tổng hợp trạng thái hồ sơ">
     <div><small>Hồ sơ đang tồn tại</small><strong>{managerInbox.length}</strong><span>Trong danh sách đã tải · Không phải số đã duyệt</span></div>
     <div><small>Chờ Owner xét duyệt</small><strong>{managerInbox.filter(m=>m.status==="pending"&&m.onboardingStage==="requested").length}</strong><span>Chưa hoàn tất bước tiếp nhận</span></div>
     <div><small>Chờ hoàn thiện</small><strong>{managerInbox.filter(m=>m.status==="pending"&&m.onboardingStage==="profile_required").length}</strong><span>Chờ hoàn thiện hồ sơ</span></div>
    </div>
    <p className="boi-manager-count">Đã đọc {managerInbox.length} hồ sơ quản lý{managerNext?" (còn trang tiếp theo)":""}.
     Chưa kích hoạt: {managerInbox.filter(m=>m.status==="pending").length} trong các trang đã tải.
     Hồ sơ quá 4 ngày chỉ được tách khỏi danh sách mặc định; không bị xóa tự động.</p>
    <div className="boi-manager-tools" role="group" aria-label="Bộ lọc tài khoản cán bộ">
     <label>Tra cứu cán bộ
      <input value={managerSearch} onChange={e=>setManagerSearch(e.target.value)}
       placeholder="Tên hoặc ID tài khoản…" aria-label="Tìm cán bộ quản lý"/>
     </label>
     <div className="boi-manager-filter">
      {([
        ["current","Đang quản lý"],["stale","Cũ quá 4 ngày"],
        ["archived","Đã lưu trữ"],["all","Tất cả"]
      ] as const).map(([filter,label])=>
       <button key={filter} type="button" aria-pressed={managerFilter===filter}
        className={managerFilter===filter?"selected":""} onClick={()=>setManagerFilter(filter)}>
        {label}{filter==="stale"?" · "+managerInbox.filter(m=>agedManager(m,observedNow)).length:""}
       </button>)}
     </div>
    </div>
    <div className="boi-manager-displayed" aria-live="polite">
    {visibleManagers.map(m=><article key={m.accountId}
      className="boi-manager-case">
     <header className="boi-manager-case-head">
      <div><small>HỒ SƠ QUẢN LÝ · {m.accountId.slice(0,14)}…</small>
       <strong>{m.name||"Hồ sơ mới chưa hoàn thiện"}</strong></div>
      <span className={m.status==="blocked"?"boi-manager-tag neutral":m.status==="approved"?"boi-manager-tag reviewed":m.onboardingStage==="profile_required"?"boi-manager-tag reviewed":"boi-manager-tag pending"}>
       {managerAccessLabel(m)}
      </span>
     </header>
     <div className="boi-manager-progress" aria-label="Tiến trình kích hoạt hồ sơ">
      <span className="done">Đã đăng ký</span>
      <span className={m.status==="blocked"?"":"done"}>Lời mời Owner</span>
      <span className={m.onboardingStage==="active"||m.onboardingStage==="suspended"?"done":
         m.onboardingStage==="profile_required"?"current":""}>Hoàn thiện hồ sơ</span>
      <span className={m.onboardingStage==="active"&&m.status==="approved"?"done":
        m.onboardingStage==="active"?"current":""}>Kích hoạt</span>
     </div>
     <div className="boi-manager-facts">
       <span><b>Đăng ký</b><strong>{moscow(m.createdAt)}</strong></span>
       <span><b>Hoạt động gần nhất</b><strong>{moscow(m.lastSeenAt)}</strong></span>
       <span><b>Phiên đăng nhập</b><strong className={m.activeSessions>0?"boi-manager-session active":"boi-manager-session"}>
        {m.activeSessions>0?"● "+m.activeSessions+" phiên còn hiệu lực":"○ Không có phiên"}
       </strong></span>
       <span><b>Tuổi hồ sơ</b><strong>{Math.max(0,Math.floor((observedNow-Date.parse(m.createdAt))/86400000))} ngày</strong></span>
     </div>
     {agedManager(m,observedNow)?<p className="boi-manager-stale">
       Hồ sơ chưa kích hoạt quá 4 ngày, không có phiên đăng nhập còn hiệu lực.
       Cần Owner rà soát trước khi lưu trữ.</p>:null}
     <p className="boi-manager-meta">ID: {m.accountId.slice(0,20)}… · Trạng thái: {m.onboardingStage}
      · Hồ sơ rev {m.onboardingRevision} · Tài khoản rev {m.accountRevision}</p>
     {m.onboardingStage==="requested"?<p className="boi-manager-guidance">
       Chưa cần duyệt thủ công. Cán bộ hoàn tất hồ sơ và tài khoản sẽ tự kích hoạt.</p>:null}
     {singleReview&&m.onboardingStage==="profile_review"?<p className="boi-oversight-note">Hồ sơ cũ cần đối soát theo luồng mới. Không tự cấp quyền hoặc kích hoạt từ trạng thái này.</p>:null}
     {m.onboardingStage==="profile_required"?<p className="boi-manager-guidance">Có lời mời của Owner. Cán bộ tự điền đầy đủ Khoa/Đơn vị, Chức danh và Chức vụ để kích hoạt ngay.</p>:null}
     {localMode && singleReview && ["requested","profile_required"].includes(m.onboardingStage)?<div className="boi-manager-test-tools">
      <button type="button" disabled={managerWriting||managerLoading}
       onClick={()=>void cancelManagerTest(m)}>Hủy hồ sơ thử nghiệm · Chỉ Offline</button>
      <small>Chỉ hủy tài khoản chưa kích hoạt, không có quyền hoặc dữ liệu đồng bộ.</small>
     </div>:null}
     {m.onboardingStage==="changes_requested"?<p>Chờ người đăng ký sửa hồ sơ.</p>:null}
     {m.status!=="blocked"?<button type="button" className="boi-manager-archive-action"
       disabled={managerWriting||managerLoading}
       onClick={()=>{setArchiveTarget(m);setArchiveConfirm("");setArchiveReason("Hồ sơ cán bộ cũ không còn sử dụng");}}>
       Gỡ quyền & lưu trữ…
     </button>:null}
    </article>)}
    {!visibleManagers.length?<p className="boi-no-data">Không có tài khoản phù hợp bộ lọc này trong các trang đã tải.</p>:null}
    </div>
    {managerNext?<button type="button" disabled={managerLoading||managerWriting}
       onClick={()=>void refreshManagerInbox(managerNext)}>Tải thêm hồ sơ</button>:null}
    {!managerInbox.some(m=>m.status==="pending") && !managerNext?
      <p>Không có yêu cầu quản lý đang chờ trong tập kết quả đã xác minh.</p>:null}
   </div>:!managerError?<p role="status">Chưa có kết quả hàng chờ được xác minh.</p>:null}
   <small>Duyệt một lần · Owner phải xác minh Authenticator trong 30 phút gần nhất để tạo mời hoặc duyệt.
    Một lần Owner duyệt với CAS, nhật ký và đọc lại; sau đó tài khoản được kích hoạt khi hoàn tất hồ sơ bắt buộc.</small>
  </details>
  <OwnerOnceRosterResetPanel/>
  <OwnerAccountCleanupPanel/>
  <OwnerAccountBlockPanel/>
  </>:null}
  {section==="policies"?<AccountCapacityPanel/>:null}
  {section==="policies"?<header><h2>Thời hạn tài khoản · Account First V2</h2>
   <p>Chính sách mặc định: cán bộ quản lý 3 ngày, giảng viên và học viên 8 ngày từ khi hoàn tất hồ sơ. Chỉ thay đổi thời hạn hoặc mặc định; không trực tiếp duyệt giảng viên/học viên.</p></header>:null}
  {section!=="accounts"&&loading?<p role="status">Đang đọc dữ liệu tài khoản từ Bơi ếch…</p>:null}
  {section!=="accounts"&&error?<div role="alert"><strong>Chưa xác minh:</strong> {error} <a href="/__account">Xác minh Authenticator (nếu được yêu cầu)</a></div>:null}
  {section!=="accounts"&&notice?<p role="status">{notice}</p>:null}
  {section!=="accounts"?<button type="button" className="boi-refresh-inline" disabled={busy||loading} onClick={()=>void refresh()}>↻ Đọc lại tài khoản từ Bơi Ếch</button>:null}
  {section==="policies"&&policies.length?<div className="boi-duration-policies">
   {policies.map(p=><label key={p.role} style={{display:"grid",gap:6}}>
    <span>{labels[p.role]||p.role} · mặc định</span>
    <input type="number" min={1} max={365} value={roleDays[p.role]??String(p.defaultDays)}
      onChange={e=>setRoleDays(x=>({...x,[p.role]:e.target.value}))}/>
    <button disabled={busy} onClick={()=>void commitPolicy(p)}>Lưu mặc định</button>
   </label>)}
  </div>:null}
  {section==="policies"?<label className="boi-policy-reason">Lý do thay đổi (ghi nhật ký)
   <input value={reason} maxLength={300} onChange={e=>setReason(e.target.value)}/>
  </label>:null}
  {section!=="accounts"?<label className="boi-policy-search">Tìm tài khoản / vai trò
   <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tên, ID, vai trò…"/>
  </label>:null}
  {section!=="accounts"?(accountsVerified?<p className="boi-verified-note">Đã xác minh {accounts.length} tài khoản; hiển thị tối đa 100 hồ sơ phù hợp bộ lọc.</p>
   :<p role="status">Chưa có danh sách tài khoản được xác minh; không suy diễn 0 tài khoản khi kết nối lỗi.</p>):null}

  {section==="oversight"&&accountsVerified?<div className="boi-owner-table-scroll">
    <table className="boi-owner-table"><thead><tr><th>Tên tài khoản</th><th>Vai trò</th><th>Hồ sơ</th><th>Trạng thái quyền</th><th>Thời hạn</th></tr></thead>
      <tbody>{displayed.map(a=><tr key={a.accountId}>
        <td><strong>{a.name||"Chưa khai báo"}</strong><small>{a.accountId.slice(0,20)}…</small></td>
        <td>{labels[a.role]||a.role}</td><td>{a.onboardingStage||"Chưa xác minh trạng thái"}</td>
        <td>{a.entitlement?.state||"Chưa kích hoạt"}</td><td>{moscow(a.entitlement?.expiresAt)}</td>
      </tr>)}</tbody></table>
    {!displayed.length?<p>Không có giảng viên/học viên phù hợp trong danh sách đã xác minh.</p>:null}
    <p className="boi-oversight-note" role="status">Giám sát chỉ đọc · Quyền duyệt giảng viên/học viên thuộc cán bộ quản lý đã được cấp scope tại Bơi Ếch.</p>
  </div>:null}
  {section==="policies"&&accountsVerified?<div className="boi-manager-expiry">
    <h3>Thời hạn cá nhân · Chỉ cán bộ quản lý</h3>
    <select className="boi-manager-choice" aria-label="Chọn tài khoản cán bộ" value={selected}
      onChange={e=>setSelected(e.target.value)}>
      <option value="">— Chọn cán bộ quản lý —</option>
      {displayed.map(a=><option key={a.accountId} value={a.accountId}>{a.name||a.accountId.slice(0,14)} · {a.entitlement?.active?"Còn hạn":a.entitlement?"Không hoạt động":"Chưa cấp"}</option>)}
    </select>
    {current?.role==="manager"?<div className="boi-manager-expiry-detail">
      <div className="boi-manager-expiry-identity">
       <strong>{current.name||current.accountId} · Cán bộ quản lý</strong>
       <small>ID: {current.accountId} · Trạng thái: {current.entitlement?.state??"Chưa cấp"}</small>
      </div>
      <div className="boi-manager-lease-summary">
       <div><small>Thời gian còn lại</small><strong>{remainingLabel(current.entitlement?.expiresAt,observedNow)}</strong></div>
       <div><small>Thời điểm hết hạn</small><strong>{moscow(current.entitlement?.expiresAt)}</strong></div>
       <div><small>Trạng thái D1</small><strong>{current.entitlement?.active?"Đang sử dụng":"Không hoạt động"}</strong></div>
      </div>
      {current.entitlement?<div className="boi-manager-lease-controls">
       <label>Thời hạn mới tính từ hôm nay · không cộng dồn
        <select aria-label="Chọn hạn sử dụng cán bộ" value={preset}
         onChange={e=>setPreset(e.target.value as typeof preset)}>
         <option value="7d">7 ngày</option><option value="30d">30 ngày</option>
         <option value="6m">6 tháng</option><option value="1y">1 năm</option>
         <option value="4y">4 năm</option><option value="forever">Vĩnh viễn</option>
        </select>
       </label>
       <div className="boi-expiry-actions">
        <button type="button" disabled={busy} onClick={()=>void commitAccount("set-preset")}>
         Đặt lại thời hạn · Xác minh D1
        </button>
       </div>
       <label>Hoặc nhập ngày hết hạn chính xác (giờ Moscow)
        <input type="datetime-local" value={expiration} onChange={e=>setExpiration(e.target.value)}/>
       </label>
       <div className="boi-expiry-actions">
        <button type="button" disabled={busy} onClick={()=>void commitAccount("set-expiry")}>
         Lưu ngày cụ thể
        </button>
        {current.entitlement.state==="active"
         ?<button type="button" disabled={busy} onClick={()=>void commitAccount("suspend")}>Tạm khóa cán bộ</button>
         :<button type="button" disabled={busy||Date.parse(current.entitlement.expiresAt)<=observedNow}
           onClick={()=>void commitAccount("resume")}>Khôi phục cán bộ</button>}
       </div>
       <p>Gỡ quyền và lưu trữ tài khoản cán bộ được thực hiện trong danh sách &ldquo;Tài khoản cán bộ quản lý&rdquo;
        bằng xác nhận Owner. Dữ liệu lịch sử được giữ để kiểm toán.</p>
      </div>:<p>Chưa kích hoạt; cần hoàn thiện hồ sơ trước khi cấp thời hạn.</p>}
    </div>:null}
  </div>:null}
  {section==="policies"?<small>Thao tác Owner với chính sách/mốc thời hạn phải có CAS, nhật ký và đọc lại Bơi Ếch. Không cấp quyền giảng viên/học viên tại màn hình này.</small>:null}
  {section==="accounts"?<p className="boi-oversight-note">Giảng viên/học viên tự kích hoạt sau khi hoàn thiện hồ sơ. Cán bộ quản lý gia hạn cho hai nhóm; Owner quản lý cán bộ.</p>:null}
 </section>
 {archiveTarget?<div className="boi-manager-archive-backdrop" role="presentation">
   <section className="boi-manager-archive-dialog" role="dialog" aria-modal="true"
      aria-label="Xác nhận gỡ quyền và lưu trữ cán bộ">
    <h2>Gỡ quyền & lưu trữ cán bộ</h2>
    <p>Thao tác thu hồi tất cả phiên đăng nhập, khóa thiết bị và quyền quản lý.
     Dữ liệu học tập, tài khoản gốc và nhật ký vẫn được giữ để kiểm toán. Không tự xóa tài khoản đang hoạt động theo tuổi hồ sơ.</p>
    <p><strong>{archiveTarget.name||"Cán bộ chưa khai báo"}</strong>
      <code>{archiveTarget.accountId}</code></p>
    <label>Lý do xử lý (tối thiểu 10 ký tự)
     <textarea rows={3} maxLength={300} value={archiveReason}
       onChange={e=>setArchiveReason(e.target.value)}/></label>
    <label>Nhập chính xác <strong>LUU TRU</strong> để xác nhận
     <input value={archiveConfirm} autoComplete="off" onChange={e=>setArchiveConfirm(e.target.value)}
       aria-label="Nhập LUU TRU để xác nhận"/></label>
    <div className="boi-manager-archive-buttons">
     <button type="button" disabled={managerWriting} onClick={()=>{setArchiveTarget(null);setArchiveConfirm("");}}>Hủy</button>
     <button type="button" disabled={managerWriting||archiveConfirm!=="LUU TRU"||archiveReason.trim().length<10}
      onClick={()=>void confirmArchiveManager()}>{managerWriting?"Đang kiểm tra…":"Xác nhận gỡ quyền"}</button>
    </div>
   </section>
 </div>:null}
 {authenticate?<AuthenticatorStepUp finish={finishAuthentication} setupRequired={authenticate==="setup"}/>:null}</>;
}

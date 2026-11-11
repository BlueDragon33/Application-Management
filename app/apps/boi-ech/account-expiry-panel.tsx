"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import AuthenticatorStepUp from "../../authenticator-step-up";
import {
 loadBoiAccountDurations,loadBoiManagerInbox,issueBoiManagerInvitation,reviewBoiManagerAccount,
 changeBoiAccountDuration,changeBoiDefaultAccountDays,cancelBoiLocalTestManager,
 type BoiAccountDurationRecord,type BoiAccountDurationPolicy,type BoiManagerInboxRecord
} from "../../boi-access-client";

const labels:Record<string,string>={manager:"Cán bộ quản lý",teacher:"Giảng viên",learner:"Học viên"};
const singleReview = process.env.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW === "true";
function moscow(value:string|null|undefined) {
 if(!value)return "Chưa cấp";
 const date=new Date(value);
 return Number.isFinite(date.getTime())?new Intl.DateTimeFormat("vi-VN",{
  timeZone:"Europe/Moscow",dateStyle:"short",timeStyle:"short"
 }).format(date)+" (Moscow)":"Không hợp lệ";
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
 const [localMode,setLocalMode]=useState(false);
 const [policies,setPolicies]=useState<BoiAccountDurationPolicy[]>([]);
 const [selected,setSelected]=useState("");
 const [search,setSearch]=useState("");
 const [roleDays,setRoleDays]=useState<Record<string,string>>({});
 const [expiration,setExpiration]=useState("");
 const [reason,setReason]=useState("Owner quản lý thời hạn sử dụng");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [accountsVerified,setAccountsVerified]=useState(false);
 const [authenticate,setAuthenticate]=useState(false);
 const authResolve=useRef<((verified:boolean)=>void)|null>(null);
 const mounted=useRef(true),writeLock=useRef(false);
 useEffect(()=>{
  mounted.current=true;
  return()=>{mounted.current=false;authResolve.current?.(false);authResolve.current=null;};
 },[]);
 function finishAuthentication(verified:boolean){
  setAuthenticate(false);authResolve.current?.(verified);authResolve.current=null;
 }
 async function withOwnerAuthentication<T,>(operation:()=>Promise<T>):Promise<T>{
  try{return await operation();}
  catch(caught){
   const data=caught instanceof Error?(caught as Error&{data?:Record<string,unknown>}).data:undefined;
   if(data?.code!=="STEP_UP_REQUIRED"||data.applied!==false||!mounted.current)throw caught;
   setAuthenticate(true);
   const allowed=await new Promise<boolean>(resolve=>{authResolve.current=resolve;});
   if(!allowed||!mounted.current)throw new Error("Đã hủy xác minh; bản nháp được giữ nguyên.");
   return operation();
  }
 }
 const [observedNow,setObservedNow]=useState(()=>Date.now());
 const current=accounts.find(a=>a.accountId===selected)??null;
 const displayed=useMemo(()=>accounts.filter(a=>(section==="oversight" ? ["teacher","learner"].includes(a.role)
  : section==="policies" ? a.role==="manager" : false)
  && [a.accountId,a.name,a.role].join(" ").toLowerCase().includes(search.toLowerCase())).slice(0,100),[accounts,search,section]);
 async function refreshManagerInbox(after=""){
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
 }
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
 async function decideManager(m:BoiManagerInboxRecord){
  if(managerWriting||writeLock.current||managerLoading||!singleReview||Boolean(managerError)||managerInbox===null||m.status!=="pending"||m.onboardingStage!=="requested")return;
  const name=m.name||m.accountId.slice(0,14);
  if(!window.confirm("Owner duyệt một lần cho "+name+"? Cán bộ tự hoàn thiện hồ sơ trước khi kích hoạt quyền và thời hạn."))return;
  writeLock.current=true;setManagerWriting(true);setManagerError("");setManagerNotice("");
  try{
   const action="manager-review-first",expectedRevision=m.onboardingRevision;
   await withOwnerAuthentication(()=>reviewBoiManagerAccount(action,m.accountId,expectedRevision));
   setManagerNotice("Bơi ếch đã xác minh và đọc lại lần duyệt từ D1.");
   await refreshManagerInbox();
  }catch(e){setManagerError(e instanceof Error?e.message:"Lệnh duyệt chưa được xác minh.");}
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
 useEffect(()=>{if(section==="accounts")queueMicrotask(()=>{void refreshManagerInbox();});},[section]);
 const currentExpiry=current?.entitlement?.expiresAt ?? null;
 useEffect(()=>{
  const next=currentExpiry?localInput(currentExpiry):"";
  queueMicrotask(()=>setExpiration(next));
 },[selected,currentExpiry]);
 async function commitAccount(operation:"set-expiry"|"suspend"|"resume"){
  if(!current?.entitlement||current.role!=="manager"||busy||writeLock.current)return;
  if(reason.trim().length<5){setError("Nhập lý do dài ít nhất 5 ký tự.");return;}
  const parsed=Date.parse(expiration?expiration+":00+03:00":"");
  const iso=operation==="set-expiry"&&Number.isFinite(parsed)?new Date(parsed).toISOString():"";
  if(operation==="set-expiry"&&!iso){setError("Chọn ngày hết hạn hợp lệ.");return;}
  if(!window.confirm(`${operation==="set-expiry"?"Đổi ngày hết hạn":operation==="suspend"?"Tạm khóa":"Khôi phục"} tài khoản ${current.name||current.accountId}?`))return;
  writeLock.current=true;setBusy(true);setError("");setNotice("");
  try{
   await withOwnerAuthentication(()=>changeBoiAccountDuration({accountId:current.accountId,expectedRevision:current.entitlement!.revision,
    operation,...(operation==="set-expiry"?{expiresAt:iso}:{}),reason:reason.trim()}));
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
 return <><section inert={authenticate} aria-hidden={authenticate||undefined} aria-label="Hồ sơ tài khoản Bơi ếch AI" className="boi-account-panel" data-section={section}>
  {section==="accounts"?<div className="boi-account-header"><span>OWNER · DUYỆT CÁN BỘ QUẢN LÝ</span><h2>Hàng chờ cán bộ</h2><p>Chỉ Owner mời và phê duyệt cán bộ quản lý; giảng viên và học viên do cán bộ quản lý xử lý tại Bơi Ếch.</p></div>:null}
  {section==="oversight"?<div className="boi-account-header"><span>GIÁM SÁT · CHỈ ĐỌC</span><h2>Giảng viên & học viên</h2><p>Hiển thị thông tin, vai trò, trạng thái hồ sơ và thời hạn để giám sát. Không duyệt, từ chối, cấp hoặc thu hồi quyền từ đây.</p></div>:null}
  {section==="policies"?<div className="boi-account-header"><span>OWNER · QUẢN TRỊ CHÍNH SÁCH</span><h2>Thời hạn & chính sách</h2><p>Thiết lập mặc định chung không phải phê duyệt tài khoản. Chỉ điều chỉnh trực tiếp tài khoản cán bộ quản lý tại màn hình này.</p></div>:null}
  {section==="accounts"?<>
  <details className="boi-manager-inbox" open>
   <summary><strong>Hồ sơ Cán bộ quản lý · Owner duyệt một lần</strong></summary>
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
     <div><small>Hồ sơ đã xác minh</small><strong>{managerInbox.length}</strong><span>Trong danh sách đã tải</span></div>
     <div><small>Chờ Owner xét duyệt</small><strong>{managerInbox.filter(m=>m.status==="pending"&&m.onboardingStage==="requested").length}</strong><span>Chưa được duyệt</span></div>
     <div><small>Chờ hoàn thiện</small><strong>{managerInbox.filter(m=>m.status==="pending"&&m.onboardingStage==="profile_required").length}</strong><span>Chờ hoàn thiện hồ sơ</span></div>
    </div>
    <p className="boi-manager-count">Đã đọc {managerInbox.length} hồ sơ quản lý{managerNext?" (còn trang tiếp theo)":""}.
     Chưa kích hoạt: {managerInbox.filter(m=>m.status==="pending").length} trong các trang đã tải.</p>
    {managerInbox.filter(m=>m.status==="pending").map(m=><article key={m.accountId}
      className="boi-manager-case">
     <header className="boi-manager-case-head">
      <div><small>HỒ SƠ QUẢN LÝ · {m.accountId.slice(0,14)}…</small>
       <strong>{m.name||"Hồ sơ mới chưa hoàn thiện"}</strong></div>
      <span className={m.onboardingStage==="profile_required"?"boi-manager-tag reviewed":"boi-manager-tag pending"}>
       {m.onboardingStage==="profile_required"?"Đã duyệt · Chờ bổ sung":m.onboardingStage==="requested"?"Chờ Owner duyệt":"Chờ xử lý"}
      </span>
     </header>
     <div className="boi-manager-progress" aria-label="Tiến trình xét duyệt">
      <span className="done">Đã đăng ký</span>
      <span className={m.onboardingStage==="requested"?"current":"done"}>Owner duyệt</span>
      <span className={m.onboardingStage==="profile_required"?"current":""}>Hoàn thiện hồ sơ</span>
      <span>Kích hoạt</span>
     </div>
     <p className="boi-manager-meta">ID: {m.accountId.slice(0,20)}… · Trạng thái: {m.onboardingStage}
      · Hồ sơ rev {m.onboardingRevision} · Tài khoản rev {m.accountRevision}</p>
     {m.onboardingStage==="requested"?<button type="button"
      disabled={managerWriting||managerLoading||!singleReview||Boolean(managerError)||managerInbox===null||m.status!=="pending"} onClick={()=>void decideManager(m)}>
       Duyệt tài khoản — chờ bổ sung hồ sơ</button>:null}
     {singleReview&&m.onboardingStage==="profile_review"?<p className="boi-oversight-note">Hồ sơ cũ cần đối soát theo luồng mới. Không tự cấp quyền hoặc kích hoạt từ trạng thái này.</p>:null}
     {m.onboardingStage==="profile_required"?<p className="boi-manager-guidance">Đã được Owner duyệt. Cán bộ tự điền Khoa/Đơn vị, Chức danh và Chức vụ trên Bơi Ếch để kích hoạt.</p>:null}
     {localMode && singleReview && ["requested","profile_required"].includes(m.onboardingStage)?<div className="boi-manager-test-tools">
      <button type="button" disabled={managerWriting||managerLoading}
       onClick={()=>void cancelManagerTest(m)}>Hủy hồ sơ thử nghiệm · Chỉ Offline</button>
      <small>Chỉ hủy tài khoản chưa kích hoạt, không có quyền hoặc dữ liệu đồng bộ.</small>
     </div>:null}
     {m.onboardingStage==="changes_requested"?<p>Chờ người đăng ký sửa hồ sơ.</p>:null}
    </article>)}
    {managerNext?<button type="button" disabled={managerLoading||managerWriting}
       onClick={()=>void refreshManagerInbox(managerNext)}>Tải thêm hồ sơ</button>:null}
    {!managerInbox.some(m=>m.status==="pending") && !managerNext?
      <p>Không có yêu cầu quản lý đang chờ trong tập kết quả đã xác minh.</p>:null}
   </div>:!managerError?<p role="status">Chưa có kết quả hàng chờ được xác minh.</p>:null}
   <small>Duyệt một lần · Owner phải xác minh Authenticator trong 30 phút gần nhất để tạo mời hoặc duyệt.
    Một lần Owner duyệt với CAS, nhật ký và đọc lại; sau đó tài khoản được kích hoạt khi hoàn tất hồ sơ bắt buộc.</small>
  </details>
  </>:null}
  {section==="policies"?<header><h2>Thời hạn tài khoản · Account First V2</h2>
   <p>Chính sách mặc định 30 ngày từ lúc hoàn tất hồ sơ và kích hoạt. Chỉ thay đổi thời hạn hoặc mặc định; không trực tiếp duyệt giảng viên/học viên.</p></header>:null}
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
    <select size={Math.min(8,Math.max(2,displayed.length+1))} aria-label="Chọn tài khoản cán bộ" value={selected}
      onChange={e=>setSelected(e.target.value)}>
      <option value="">— Chọn cán bộ quản lý —</option>
      {displayed.map(a=><option key={a.accountId} value={a.accountId}>{a.name||a.accountId.slice(0,14)} · {a.entitlement?.active?"Còn hạn":a.entitlement?"Không hoạt động":"Chưa cấp"}</option>)}
    </select>
    {current?.role==="manager"?<div className="boi-manager-expiry-detail">
      <strong>{current.name||current.accountId} — Cán bộ quản lý</strong>
      <small>ID: {current.accountId} · Hồ sơ: {current.onboardingStage||"Chưa có"}</small>
      <div>Hạn tài khoản: <strong>{moscow(current.entitlement?.expiresAt)}</strong></div>
      <div>Hạn thiết bị cũ: {moscow(current.deviceAccessExpiresAt)} · Thanh toán thiết bị: {current.paymentStatus??"—"}</div>
      <div>Trạng thái: {current.entitlement?.state??"Chưa kích hoạt"} · Revision: {current.entitlement?.revision??"—"}</div>
      {current.entitlement?<><label>Đặt thời hạn mới
        <input type="datetime-local" value={expiration} onChange={e=>setExpiration(e.target.value)}/>
      </label><div className="boi-expiry-actions">
        <button type="button" disabled={busy} onClick={()=>void commitAccount("set-expiry")}>Lưu ngày hết hạn</button>
        <button type="button" disabled={busy} onClick={()=>setExpiration(localInput(new Date(Date.now()+30*86400000).toISOString()))}>+30 ngày từ hôm nay</button>
        {current.entitlement.state==="active"
          ?<button type="button" disabled={busy} onClick={()=>void commitAccount("suspend")}>Tạm khóa cán bộ</button>
          :<button type="button" disabled={busy||Date.parse(current.entitlement.expiresAt)<=observedNow} onClick={()=>void commitAccount("resume")}>Khôi phục cán bộ</button>}
      </div></>:<p>Chưa kích hoạt; cần hoàn thành hồ sơ để được cấp thời hạn.</p>}
    </div>:null}
  </div>:null}
  {section==="policies"?<small>Thao tác Owner với chính sách/mốc thời hạn phải có CAS, nhật ký và đọc lại Bơi Ếch. Không cấp quyền giảng viên/học viên tại màn hình này.</small>:null}
  {section==="accounts"?<p className="boi-oversight-note">Giảng viên/học viên được cán bộ quản lý phê duyệt tại Bơi Ếch theo phạm vi; Owner chỉ giám sát dữ liệu.</p>:null}
 </section>{authenticate?<AuthenticatorStepUp finish={finishAuthentication}/>:null}</>;
}

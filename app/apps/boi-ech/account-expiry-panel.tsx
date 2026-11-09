"use client";

import {useEffect,useMemo,useState} from "react";
import {
 loadBoiAccountDurations,changeBoiAccountDuration,changeBoiDefaultAccountDays,
 type BoiAccountDurationRecord,type BoiAccountDurationPolicy
} from "../../boi-access-client";

const labels:Record<string,string>={manager:"Cán bộ quản lý",teacher:"Giảng viên",learner:"Học viên"};
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
export default function AccountExpiryPanel(){
 const [accounts,setAccounts]=useState<BoiAccountDurationRecord[]>([]);
 const [policies,setPolicies]=useState<BoiAccountDurationPolicy[]>([]);
 const [selected,setSelected]=useState("");
 const [search,setSearch]=useState("");
 const [roleDays,setRoleDays]=useState<Record<string,string>>({});
 const [expiration,setExpiration]=useState("");
 const [reason,setReason]=useState("Owner quản lý thời hạn sử dụng");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const current=accounts.find(a=>a.accountId===selected)??null;
 const displayed=useMemo(()=>accounts.filter(a=>[a.accountId,a.name,a.role].join(" ").toLowerCase().includes(search.toLowerCase())).slice(0,100),[accounts,search]);
 async function refresh(){
  setLoading(true);setError("");
  try {
   const next=await loadBoiAccountDurations();
   setAccounts(next.accounts);setPolicies(next.policies);
   setRoleDays(Object.fromEntries(next.policies.map(p=>[p.role,String(p.defaultDays)])));
   setSelected(s=>next.accounts.some(a=>a.accountId===s)?s:"");
  }catch(e){setError(e instanceof Error?e.message:"Không tải được tài khoản.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[]);
 useEffect(()=>{setExpiration(current?.entitlement?.expiresAt?localInput(current.entitlement.expiresAt):"");},[selected,accounts]);
 async function commitAccount(operation:"set-expiry"|"suspend"|"resume"){
  if(!current?.entitlement||busy)return;
  if(reason.trim().length<5){setError("Nhập lý do dài ít nhất 5 ký tự.");return;}
  const parsed=Date.parse(expiration?expiration+":00+03:00":"");
  const iso=operation==="set-expiry"&&Number.isFinite(parsed)?new Date(parsed).toISOString():"";
  if(operation==="set-expiry"&&!iso){setError("Chọn ngày hết hạn hợp lệ.");return;}
  if(!window.confirm(`${operation==="set-expiry"?"Đổi ngày hết hạn":operation==="suspend"?"Tạm khóa":"Khôi phục"} tài khoản ${current.name||current.accountId}?`))return;
  setBusy(true);setError("");setNotice("");
  try{
   await changeBoiAccountDuration({accountId:current.accountId,expectedRevision:current.entitlement.revision,
    operation,...(operation==="set-expiry"?{expiresAt:iso}:{}),reason:reason.trim()});
   setNotice("Đã lưu và đọc lại hạn tài khoản. Quyền thiết bị và thanh toán vẫn được kiểm soát riêng.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Không xác minh được thay đổi.");}
  finally{setBusy(false);}
 }
 async function commitPolicy(p:BoiAccountDurationPolicy){
  if(busy)return;const days=Number(roleDays[p.role]);
  if(!Number.isInteger(days)||days<1||days>365){setError("Mặc định phải từ 1–365 ngày.");return;}
  setBusy(true);setError("");setNotice("");
  try{
   await changeBoiDefaultAccountDays({role:p.role,defaultDays:days,expectedRevision:p.revision,reason:reason.trim()});
   setNotice("Đã cập nhật mặc định và đọc lại từ D1. Tài khoản đang dùng không bị đổi hạn tự động.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Không cập nhật được mặc định.");}
  finally{setBusy(false);}
 }
 return <section aria-label="Hạn tài khoản Bơi ếch AI" style={{border:"1px solid currentColor",borderRadius:12,padding:16,margin:"16px 0",display:"grid",gap:12}}>
  <header><h2>Thời hạn tài khoản · Account First V2</h2>
   <p>Chính sách mặc định 30 ngày từ lần duyệt thứ hai. Hạn tài khoản không phải hạn thiết bị, thanh toán hay API Token Cloudflare.</p></header>
  {loading?<p role="status">Đang đọc dữ liệu tài khoản từ Bơi ếch…</p>:null}
  {error?<div role="alert"><strong>Chưa xác minh:</strong> {error} <a href="/__account">Xác minh Authenticator (nếu được yêu cầu)</a></div>:null}
  {notice?<p role="status">{notice}</p>:null}
  <button type="button" disabled={busy||loading} onClick={()=>void refresh()}>Đồng bộ từ Bơi ếch</button>
  {policies.length?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
   {policies.map(p=><label key={p.role} style={{display:"grid",gap:6}}>
    <span>{labels[p.role]||p.role} · mặc định</span>
    <input type="number" min={1} max={365} value={roleDays[p.role]??String(p.defaultDays)}
      onChange={e=>setRoleDays(x=>({...x,[p.role]:e.target.value}))}/>
    <button disabled={busy} onClick={()=>void commitPolicy(p)}>Lưu mặc định</button>
   </label>)}
  </div>:null}
  <label style={{display:"grid",gap:6}}>Lý do thay đổi (ghi nhật ký)
   <input value={reason} maxLength={300} onChange={e=>setReason(e.target.value)}/>
  </label>
  <label style={{display:"grid",gap:6}}>Tìm tài khoản / vai trò
   <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tên, ID, cán bộ, học viên…"/>
  </label>
  <p>Đã tải {accounts.length} tài khoản. Danh sách hiển thị tối đa 100 kết quả; nhập tìm kiếm để lọc.</p>
  <select size={Math.min(8,Math.max(2,displayed.length))} aria-label="Chọn tài khoản" value={selected}
   onChange={e=>setSelected(e.target.value)}>
   <option value="">— Chọn tài khoản —</option>
   {displayed.map(a=><option key={a.accountId} value={a.accountId}>{a.name||a.accountId.slice(0,14)} · {labels[a.role]||a.role} · {a.entitlement?.active?"Còn hạn":a.entitlement?"Không hoạt động":"Chưa cấp"}</option>)}
  </select>
  {current?<div style={{display:"grid",gap:8}}>
   <strong>{current.name||current.accountId} — {labels[current.role]||current.role}</strong>
   <small>ID: {current.accountId} · Onboarding: {current.onboardingStage||"chưa có"}</small>
   <div>Hạn tài khoản: <strong>{moscow(current.entitlement?.expiresAt)}</strong></div>
   <div>Hạn quyền thiết bị cũ: <strong>{moscow(current.deviceAccessExpiresAt)}</strong> · Thanh toán: {current.paymentStatus??"—"}</div>
   {current.deviceAccessExpired ? <p role="alert">Quyền thiết bị cũ đã hết hạn. Gia hạn tài khoản không tự gia hạn quyền thiết bị hoặc thanh toán. Kiểm tra tại “Thiết bị & tiến độ”.</p> : null}
   <div>Trạng thái: {current.entitlement?.state??"Chưa kích hoạt"} · Revision: {current.entitlement?.revision??"—"}</div>
   {current.entitlement?<><label>Đặt thời hạn mới
    <input type="datetime-local" value={expiration} onChange={e=>setExpiration(e.target.value)}/>
   </label><div style={{display:"flex",flexWrap:"wrap",gap:8}}>
    <button disabled={busy} onClick={()=>void commitAccount("set-expiry")}>Lưu ngày hết hạn</button>
    <button disabled={busy} onClick={()=>{setExpiration(localInput(new Date(Date.now()+30*86400000).toISOString()));}}>+30 ngày từ hôm nay</button>
    {current.entitlement.state==="active"
     ?<button disabled={busy} onClick={()=>void commitAccount("suspend")}>Tạm khóa</button>
     :<button disabled={busy||Date.parse(current.entitlement.expiresAt)<=Date.now()} onClick={()=>void commitAccount("resume")}>Khôi phục</button>}
   </div></>:<p>Tài khoản chưa qua lần duyệt thứ hai hoặc đang được giữ để đối chiếu dữ liệu cũ. Không cấp quyền tự động.</p>}
  </div>:null}
  <small>Chỉ Owner có quyền sửa. Mọi thay đổi cần CAS, nhật ký và đọc lại từ Bơi ếch. Dữ liệu học tập không bị xóa khi hết hạn.</small>
 </section>;
}

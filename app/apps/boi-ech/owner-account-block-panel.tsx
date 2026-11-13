"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import AuthenticatorStepUp from "../../authenticator-step-up";
import {loadBoiAccountDurations,permanentlyBlockBoiAccount,
 type BoiAccountDurationRecord} from "../../boi-access-client";
import styles from "./owner-account-block-panel.module.css";
const roles:Record<string,string>={manager:"Cán bộ quản lý",teacher:"Giảng viên",learner:"Học viên"};
export default function OwnerAccountBlockPanel(){
 const [records,setRecords]=useState<BoiAccountDurationRecord[]|null>(null);
 const [chosen,setChosen]=useState<BoiAccountDurationRecord|null>(null);
 const [search,setSearch]=useState("");
 const [reason,setReason]=useState("Owner xác nhận ngăn tài khoản và thiết bị đăng nhập trở lại");
 const [suffix,setSuffix]=useState("");
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false),[auth,setAuth]=useState<"verify"|"setup"|null>(null);
 const resolver=useRef<((ok:boolean)=>void)|null>(null),lock=useRef(false);
 useEffect(()=>()=>{resolver.current?.(false);resolver.current=null;},[]);
 const filtered=useMemo(()=>records?.filter(r=>(r.name+" "+r.accountId+" "+r.role)
  .toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")))??[],[records,search]);
 async function refresh(){
  if(lock.current)return;setBusy(true);setError("");
  try{const d=await loadBoiAccountDurations();setRecords(d.accounts);}
  catch(e){setRecords(null);setError(e instanceof Error?e.message:"Chưa xác minh danh sách.");}
  finally{setBusy(false);}
 }
 function finish(ok:boolean){setAuth(null);resolver.current?.(ok);resolver.current=null;}
 async function block(){
  const r=chosen;
  if(!r||lock.current||suffix!==r.accountId.slice(-6)||reason.trim().length<10)return;
  if(!window.confirm("Chặn vĩnh viễn "+(r.name||r.accountId)+
     " và toàn bộ khóa thiết bị đã biết? Tất cả phiên đăng nhập sẽ bị thu hồi."))return;
  lock.current=true;setBusy(true);setError("");
  const execute=()=>permanentlyBlockBoiAccount({accountId:r.accountId,
   expectedRevision:r.accountRevision,confirmation:r.accountId,reason:reason.trim()});
  try{
   try{await execute();}
   catch(e){
    const data=e instanceof Error?(e as Error&{data?:Record<string,unknown>}).data:null;
    if(data?.code!=="STEP_UP_REQUIRED"||data.applied!==false)throw e;
    setAuth(data.authenticatorSetupRequired===true?"setup":"verify");
    const ok=await new Promise<boolean>(resolve=>{resolver.current=resolve;});
    if(!ok)throw new Error("Đã hủy xác minh; lệnh chặn chưa được thực thi.");
    await execute();
   }
   setChosen(null);setSuffix("");
   setNotice("Đã chặn tài khoản và các khóa thiết bị đã được liên kết. Lịch sử D1 vẫn được bảo toàn.");
   const rows=await loadBoiAccountDurations();setRecords(rows.accounts);
  }catch(e){setError(e instanceof Error?e.message:"Không xác minh được kết quả; không tự gửi lại.");
  }finally{lock.current=false;setBusy(false);}
 }
 return <>
 <section className={styles.panel} inert={auth!==null} aria-hidden={auth!==null?true:undefined}
  aria-label="Chặn tài khoản và khóa thiết bị đăng nhập lại">
  <header><div><small>OWNER · AN NINH TÀI KHOẢN</small><h3>Chặn đăng nhập vĩnh viễn</h3></div>
   <button type="button" disabled={busy} onClick={()=>void refresh()}>Đọc tài khoản từ D1</button></header>
  <p>Áp dụng cho tất cả vai trò. Thu hồi phiên, khóa quyền tài khoản và ghi mã băm
    tên đăng nhập/khóa P-256 thiết bị đã biết vào danh sách cấm. Không xóa dữ liệu học
    hoặc nhật ký; không thể nhận diện một tài khoản hoàn toàn mới dùng thông tin và khóa mới.</p>
  {error?<p className={styles.error} role="alert">{error}</p>:null}
  {notice?<p className={styles.notice} role="status">{notice}</p>:null}
  {records?<><label>Tìm tên / ID / vai trò
    <input value={search} onChange={e=>setSearch(e.target.value)}
     placeholder="Tìm tài khoản đang sử dụng…" disabled={busy}/></label>
    <div className={styles.list}>
    {filtered.slice(0,100).map(r=><button type="button" key={r.accountId}
      className={styles.person} data-status={r.deviceStatus} disabled={busy||r.deviceStatus==="blocked"}
      onClick={()=>{setChosen(r);setSuffix("");setError("");}}>
     <strong>{r.name||"Tài khoản chưa khai báo"}</strong>
     <small>{roles[r.role]||r.role} · {r.deviceStatus==="blocked"?"Đã bị chặn":r.deviceStatus==="approved"?"Đang hoạt động":"Đang hoàn thiện"}</small>
     <code>{r.accountId.slice(0,22)}…</code>
    </button>)}
    {!filtered.length?<p>Không có tài khoản phù hợp.</p>:null}
    </div></>:<p>Nhấn “Đọc tài khoản từ D1” để xác minh danh sách.</p>}
  {chosen?<div className={styles.danger}>
    <h4>Chặn quyền và khóa thiết bị · {chosen.name||chosen.accountId}</h4>
    <p>Tài khoản sau khi chặn sẽ không sử dụng được nữa. Tên đăng nhập và khóa thiết bị đã biết
       không thể dùng để đăng ký lại.</p>
    <label>Lý do (tối thiểu 10 ký tự)
     <textarea value={reason} maxLength={300} rows={2} disabled={busy}
      onChange={e=>setReason(e.target.value)}/></label>
    <label>Nhập 6 ký tự cuối mã tài khoản: <strong>{chosen.accountId.slice(-6)}</strong>
     <input value={suffix} maxLength={6} autoComplete="off" disabled={busy}
      onChange={e=>setSuffix(e.target.value.toLowerCase())}/></label>
    <div><button type="button" disabled={busy} onClick={()=>setChosen(null)}>Hủy</button>
     <button type="button" className={styles.block}
      disabled={busy||suffix!==chosen.accountId.slice(-6)||reason.trim().length<10}
      onClick={()=>void block()}>{busy?"Đang xác minh…":"Chặn vĩnh viễn · Owner MFA"}</button></div>
   </div>:null}
 </section>
 {auth?<AuthenticatorStepUp finish={finish} setupRequired={auth==="setup"}/>:null}
 </>;
}

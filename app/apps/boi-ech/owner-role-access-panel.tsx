"use client";
import {useEffect,useRef,useState} from "react";
import AuthenticatorStepUp from "../../authenticator-step-up";
import {readBoiRoleCapacity,updateBoiRoleCapacity,
 readBoiCanonicalAccount,permanentlyBlockBoiAccount,type BoiRoleCapacity} from "../../boi-access-client";
import styles from "./owner-role-access.module.css";
const titles:Record<BoiRoleCapacity["role"],string>={
 manager:"Cán bộ quản lý",teacher:"Giảng viên",learner:"Học viên"};
type Account={accountId:string;name:string|null;role:string;status:string;revision:number};
export default function OwnerRoleAccessPanel(){
 const [limits,setLimits]=useState<BoiRoleCapacity[]|null>(null);
 const [draft,setDraft]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [notice,setNotice]=useState(""),[error,setError]=useState("");
 const [reason,setReason]=useState("Điều chỉnh số lượng đăng ký theo quy mô vận hành");
 const [target,setTarget]=useState(""),[targetAccount,setTargetAccount]=useState<Account|null>(null);
 const [banReason,setBanReason]=useState("Owner khóa tài khoản và thiết bị do vi phạm chính sách sử dụng");
 const [suffix,setSuffix]=useState("");
 const [stepUp,setStepUp]=useState<"setup"|"verify"|null>(null);
 const stepResolve=useRef<((yes:boolean)=>void)|null>(null);
 const lock=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;queueMicrotask(()=>{void refresh();});
  return()=>{mounted.current=false;stepResolve.current?.(false);stepResolve.current=null;};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 async function refresh(){
  if(lock.current)return;setLoading(true);setError("");
  try{
   const next=await readBoiRoleCapacity();
   if(!mounted.current)return;
   setLimits(next);setDraft(Object.fromEntries(next.map(p=>[p.role,String(p.accountLimit)])));
  }catch(e){if(mounted.current){setLimits(null);
    setError(e instanceof Error?e.message:"Không xác minh được giới hạn D1.");}}
  finally{if(mounted.current)setLoading(false);}
 }
 function finishStepUp(ok:boolean){
  setStepUp(null);stepResolve.current?.(ok);stepResolve.current=null;
 }
 async function withMfa<T,>(action:()=>Promise<T>):Promise<T>{
  try{return await action();}
  catch(e){
   const data=e instanceof Error?(e as Error&{data?:Record<string,unknown>}).data:undefined;
   if(data?.code!=="STEP_UP_REQUIRED"||data.applied!==false||!mounted.current)throw e;
   setStepUp(data.authenticatorSetupRequired===true?"setup":"verify");
   const accepted=await new Promise<boolean>(resolve=>{stepResolve.current=resolve;});
   if(!accepted||!mounted.current)throw new Error("Đã hủy xác minh Owner.");
   return action();
  }
 }
 async function saveLimit(policy:BoiRoleCapacity){
  const value=Number(draft[policy.role]);
  if(lock.current||!Number.isSafeInteger(value)||value<1||value>5000||
   reason.trim().length<10){setError("Giới hạn từ 1–5.000 và lý do ít nhất 10 ký tự.");return;}
  if(!window.confirm("Thay đổi giới hạn đăng ký "+titles[policy.role]+" thành "+value+
    "? Người dùng đã đăng ký vẫn được giữ; đăng ký mới bị khóa khi đã đầy."))return;
  lock.current=true;setBusy(true);setError("");setNotice("");
  try{
   const after=await withMfa(()=>updateBoiRoleCapacity(policy.role,value,policy.revision,reason.trim()));
   if(mounted.current){setLimits(after);
    setDraft(Object.fromEntries(after.map(p=>[p.role,String(p.accountLimit)])));
    setNotice("Đã cập nhật và đọc lại giới hạn "+titles[policy.role]+" từ D1.");}
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:"Không lưu được giới hạn.");}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 async function lookup(){
  if(lock.current)return;
  setTargetAccount(null);setError("");setNotice("");setSuffix("");
  if(!/^acc_[a-f0-9]{64}$/.test(target.trim())){setError("Nhập đúng ID tài khoản acc_… để tránh khóa nhầm.");return;}
  lock.current=true;setLoading(true);
  try{const account=await readBoiCanonicalAccount(target.trim());if(mounted.current)setTargetAccount(account);}
  catch(e){if(mounted.current)setError(e instanceof Error?e.message:"Không đọc được hồ sơ.");}
  finally{lock.current=false;if(mounted.current)setLoading(false);}
 }
 async function block(){
  const a=targetAccount;
  if(!a||busy||lock.current||suffix!==a.accountId.slice(-6)||
     banReason.trim().length<10)return;
  if(!window.confirm("KHÓA VĨNH VIỄN "+(a.name||a.accountId)+"? Tất cả phiên, thiết bị đã biết và tên đăng nhập sẽ bị chặn. Cần Owner xử lý riêng nếu muốn gỡ."))return;
  lock.current=true;setBusy(true);setError("");setNotice("");
  try{
   await withMfa(()=>permanentlyBlockBoiAccount(a.accountId,a.revision,banReason.trim()));
   if(mounted.current){setTargetAccount(null);setSuffix("");
    setNotice("Đã xác minh khóa tài khoản, thu hồi tất cả phiên và cấm đăng nhập bằng tên/khóa thiết bị đã biết.");}
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:"Không xác minh được lệnh khóa.");}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 return <>
 <section className={styles.root} inert={stepUp!==null} aria-label="Giới hạn và chặn tài khoản Bơi Ếch">
  <header><div><small>OWNER · CHÍNH SÁCH ĐĂNG KÝ</small><h2>Giới hạn tài khoản và kiểm soát truy cập</h2>
   <p>Giới hạn tính theo toàn bộ hồ sơ đã đăng ký trong D1. Đầy giới hạn thì chặn đăng ký mới;
    không xóa tài khoản đang có khi giảm giới hạn.</p></div>
   <button type="button" disabled={busy||loading} onClick={()=>void refresh()}>↻ Đọc lại D1</button>
  </header>
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
  {notice?<p role="status" className={styles.success}>{notice}</p>:null}
  <div className={styles.capacity}>
   {limits?limits.map(p=><article key={p.role} data-full={p.remaining<=0}>
    <strong>{titles[p.role]}</strong><span>{p.used}/{p.accountLimit} đã đăng ký</span>
    <meter min={0} max={Math.max(1,p.accountLimit,p.used)} value={p.used}/>
    <small>{p.remaining<=0?"Đã đủ chỗ · Không thể đăng ký thêm":p.remaining+" suất còn lại"}</small>
    <label>Giới hạn tối đa
     <input type="number" min={1} max={5000} value={draft[p.role]??""}
      disabled={busy} onChange={e=>setDraft(old=>({...old,[p.role]:e.target.value}))}/></label>
    <button type="button" disabled={busy||loading||draft[p.role]===String(p.accountLimit)}
      onClick={()=>void saveLimit(p)}>Lưu giới hạn</button>
   </article>):<p role="status">{loading?"Đang xác minh D1…":"Chưa có số liệu được xác minh."}</p>}
  </div>
  <label className={styles.reason}>Lý do thay đổi chính sách
    <input value={reason} maxLength={300} onChange={e=>setReason(e.target.value)}/></label>
  <section className={styles.ban} aria-label="Khóa vĩnh viễn tài khoản và thiết bị">
   <h3>Chặn tài khoản và các thiết bị đã liên kết</h3>
   <p>Trước khi khóa, phải đọc đúng ID và revision từ máy chủ. Tên đăng nhập cùng các
     khóa P-256 đã biết được đưa vào danh sách cấm. Không thể nhận diện tuyệt đối người dùng
     nếu họ tạo tài khoản và thiết bị hoàn toàn mới.</p>
   <label>ID tài khoản chính xác
     <input value={target} disabled={busy} placeholder="acc_..." autoComplete="off"
      onChange={e=>{setTarget(e.target.value.trim());setTargetAccount(null);setSuffix("");}}/></label>
   <button type="button" disabled={busy||loading} onClick={()=>void lookup()}>Kiểm tra tài khoản</button>
   {targetAccount?<div className={styles.banDetail}>
     <strong>{targetAccount.name||"Chưa khai báo tên"}</strong>
     <small>{titles[targetAccount.role as BoiRoleCapacity["role"]]||targetAccount.role}
       {" · "}{targetAccount.status} · Revision {targetAccount.revision}</small>
     <label>Lý do khóa
       <textarea value={banReason} rows={2} maxLength={300}
        disabled={busy} onChange={e=>setBanReason(e.target.value)}/></label>
     <label>Nhập 6 ký tự cuối: <b>{targetAccount.accountId.slice(-6)}</b>
       <input autoComplete="off" maxLength={6} value={suffix} disabled={busy}
        onChange={e=>setSuffix(e.target.value.trim().toLowerCase())}/></label>
     <button type="button" className={styles.danger} disabled={busy||
       targetAccount.status==="blocked"||suffix!==targetAccount.accountId.slice(-6)||
       banReason.trim().length<10} onClick={()=>void block()}>
       {busy?"Đang xác minh…":"Khóa vĩnh viễn & thu hồi mọi phiên"}</button>
   </div>:null}
  </section>
 </section>
 {stepUp?<AuthenticatorStepUp finish={finishStepUp} setupRequired={stepUp==="setup"}/>:null}
 </>;
}

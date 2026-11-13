"use client";
import {useEffect,useRef,useState} from "react";
import AuthenticatorStepUp from "../../authenticator-step-up";
import {loadBoiRegistrationQuotas,changeBoiRegistrationQuota,type BoiRegistrationQuota} from "../../boi-access-client";
import styles from "./account-capacity-panel.module.css";
const titles:Record<string,string>={manager:"Cán bộ quản lý",teacher:"Giảng viên",learner:"Học viên"};
export default function AccountCapacityPanel(){
 const [quotas,setQuotas]=useState<BoiRegistrationQuota[]|null>(null);
 const [values,setValues]=useState<Record<string,string>>({});
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false),[auth,setAuth]=useState<"verify"|"setup"|null>(null);
 const resolver=useRef<((ok:boolean)=>void)|null>(null);
 const lock=useRef(false);
 useEffect(()=>()=>{resolver.current?.(false);resolver.current=null;},[]);
 async function refresh(){
  if(lock.current)return;
  setBusy(true);setError("");
  try{const rows=await loadBoiRegistrationQuotas();setQuotas(rows);
   setValues(Object.fromEntries(rows.map(x=>[x.role,String(x.accountLimit)])));}
  catch(e){setQuotas(null);setError(e instanceof Error?e.message:"Không tải được hạn mức từ D1.");}
  finally{setBusy(false);}
 }
 async function update(row:BoiRegistrationQuota){
  const next=Number(values[row.role]);
  if(lock.current||!Number.isSafeInteger(next)||next<1||next>5000)return;
  if(next===row.accountLimit)return;
  if(!window.confirm("Đổi hạn mức đăng ký "+titles[row.role]+" từ "+row.accountLimit+
      " lên "+next+"? Các hồ sơ đã đăng ký được giữ nguyên."))return;
  lock.current=true;setBusy(true);setError("");setNotice("");
  const apply=()=>changeBoiRegistrationQuota({role:row.role,accountLimit:next,expectedRevision:row.revision});
  try{
   let result:BoiRegistrationQuota[];
   try{result=await apply();}
   catch(e){
    const data=e instanceof Error?(e as Error&{data?:Record<string,unknown>}).data:null;
    if(data?.code!=="STEP_UP_REQUIRED"||data.applied!==false)throw e;
    setAuth(data.authenticatorSetupRequired===true?"setup":"verify");
    const ok=await new Promise<boolean>(resolve=>{resolver.current=resolve;});
    if(!ok)throw new Error("Đã hủy xác minh Owner; chưa cập nhật hạn mức.");
    result=await apply();
   }
   const checked=result.find(x=>x.role===row.role);
   if(!checked||checked.accountLimit!==next||checked.revision!==row.revision+1)
    throw new Error("Hạn mức chưa khớp kết quả đọc lại từ D1.");
   setQuotas(result);setValues(Object.fromEntries(result.map(x=>[x.role,String(x.accountLimit)])));
   setNotice("Đã cập nhật hạn mức "+titles[row.role]+": "+next+" tài khoản.");
  }catch(e){setError(e instanceof Error?e.message:"Chưa thể thay đổi hạn mức.");}
  finally{lock.current=false;setBusy(false);}
 }
 function finish(ok:boolean){setAuth(null);resolver.current?.(ok);resolver.current=null;}
 return <>
  <section className={styles.panel} inert={auth!==null} aria-hidden={auth!==null?true:undefined}
    aria-label="Giới hạn đăng ký toàn hệ thống">
   <header><div><small>OWNER · CHÍNH SÁCH ĐĂNG KÝ</small><h3>Giới hạn số tài khoản</h3></div>
    <button type="button" disabled={busy} onClick={()=>void refresh()}>Đồng bộ hạn mức D1</button></header>
   <p>Đăng ký mới sẽ bị từ chối khi số tài khoản đã đăng ký đạt giới hạn. Hạn mức tính cả hồ sơ đang hoàn thiện và đã hết hạn, không phải chỉ tài khoản online. Owner có thể tăng hoặc giảm giới hạn.</p>
   {error?<p className={styles.error} role="alert">{error}</p>:null}
   {notice?<p role="status">{notice}</p>:null}
   {quotas?<div className={styles.grid}>
    {quotas.map(row=><article key={row.role}>
      <h4>{titles[row.role]}</h4>
      <div className={styles.count}><strong>{row.used}</strong><span>/ {row.accountLimit} tài khoản</span></div>
      <label>Hạn mức cho đăng ký mới
       <input type="number" min={1} max={5000} step={1} disabled={busy}
        value={values[row.role]??String(row.accountLimit)}
        onChange={e=>setValues(v=>({...v,[row.role]:e.target.value}))}/></label>
      <button type="button" disabled={busy||Number(values[row.role])===row.accountLimit||
       !Number.isSafeInteger(Number(values[row.role]))||Number(values[row.role])<1||
       Number(values[row.role])>5000} onClick={()=>void update(row)}>Lưu giới hạn · MFA</button>
      <small>{row.used>=row.accountLimit?"Đã đầy · Đăng ký mới sẽ bị chặn":"Còn "+Math.max(0,row.accountLimit-row.used)+" chỗ đăng ký"}</small>
    </article>)}
   </div>:<p role="status">Nhấn “Đồng bộ hạn mức D1” để đọc chính sách hiện hành; không sử dụng số liệu giả.</p>}
  </section>
  {auth?<AuthenticatorStepUp finish={finish} setupRequired={auth==="setup"}/>:null}
 </>;
}

"use client";
import { useRef, useState } from "react";
import { operationsAction } from "./admin-device-client";
import type { AccountControlRow } from "./boi-account-permissions.server";
import { runOwnerStepUp } from "./owner-step-up";
import { useInlineOwnerStepUp } from "./use-inline-owner-step-up";
import styles from "./boi-manager-tier-view.module.css";
export default function BoiAccountPermissionsView() {
  const stepUp=useInlineOwnerStepUp();
  const [accounts,setAccounts]=useState<AccountControlRow[]>([]),[message,setMessage]=useState("");
  const [busy,setBusy]=useState(false),[expiry,setExpiry]=useState("");const lock=useRef(false);
  async function reload() {
    const result=await operationsAction({action:"boi-account-permissions",operation:"list"}) as unknown as {ok?:boolean;accounts?:AccountControlRow[];error?:string};
    if(result.ok!==true||!Array.isArray(result.accounts))throw new Error(result.error??"Luồng tài khoản chưa được bật hoặc chưa xác minh D1.");
    setAccounts(result.accounts);
  }
  async function run(task:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setMessage("");try{await task()}catch(e){setMessage(e instanceof Error?e.message:"Chưa xác minh được thao tác.")}finally{lock.current=false;setBusy(false)}}
  async function change(account:AccountControlRow,operation:string,enabled=true){
    if(!window.confirm(`${enabled?"Cấp / duyệt":"Thu hồi"} ${operation==="read-all"?"quyền xem hồ sơ mở rộng":"quyền cán bộ"} cho ${account.name||account.personCode}?`))return;
    await run(async()=>{
      const expiresAt=enabled&&operation==="read-all"?Date.parse(expiry):null;
      if(enabled&&operation==="read-all"&&(!expiresAt||expiresAt<=Date.now()))throw new Error("Chọn thời hạn hiệu lực trong tương lai cho quyền xem mở rộng.");
      const result=await runOwnerStepUp(()=>operationsAction({action:"boi-account-permissions",operation,accountId:account.accountId,
        expectedRevision:account.revision,enabled,expiresAt}),stepUp.authenticate);
      if(result.ok!==true)throw new Error(result.error??"Chưa xác minh D1.");
      await reload();setMessage("Đã xác minh bằng lần đọc D1 độc lập; thao tác được ghi audit tại Bơi Ếch.");
    });
  }
  return <details className={styles.root} tabIndex={-1}><summary>Quyền theo tài khoản · luồng mới khi được bật</summary>
    <p>Một người được duyệt một lần trên mọi thiết bị. Quyền xét duyệt và quyền xem hồ sơ mở rộng được cấp riêng. Trung tâm chỉ lưu trạng thái quản trị.</p>
    <button type="button" disabled={busy} onClick={()=>void run(reload)}>Đọc tài khoản cán bộ từ Bơi Ếch</button>
    <label>Hết hạn quyền xem mở rộng<input type="datetime-local" value={expiry} disabled={busy} onChange={e=>setExpiry(e.target.value)}/></label>
    {message&&<p role="status">{message}</p>}
    {accounts.map(a=>{const broad=a.permissions.find(p=>p.scope==="registrants.read.all");const management=a.permissions.find(p=>p.scope==="manager.manage.assigned");return <article key={a.accountId}>
      <h3>{a.name||a.personCode}</h3><p>{a.personCode} · {a.status} · phiên bản {a.revision}</p>
      <p>Xem mở rộng: {broad?.effective?"Đang có hiệu lực":broad?.configured?"Đã cấu hình, chưa có hiệu lực":"Chưa cấp"}</p>
      <div className={styles.actions}>{a.status==="pending"?<button disabled={busy} onClick={()=>void change(a,"approve-manager")}>Duyệt cán bộ và cấp quyền điều phối</button>:a.status==="approved"?<button disabled={busy} onClick={()=>void change(a,"management",!management?.configured)}>{management?.configured?"Thu hồi điều phối":"Cấp điều phối"}</button>:null}
        {a.status==="approved"||broad?.configured?<button disabled={busy} onClick={()=>void change(a,"read-all",!broad?.configured)}>{broad?.configured?"Thu hồi xem mở rộng":"Cấp xem mở rộng"}</button>:null}</div>
    </article>})}
    {stepUp.dialog}
  </details>;
}

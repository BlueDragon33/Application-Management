"use client";
import {useCallback,useEffect,useRef,useState} from "react";

type Limits={learnerLimit:number;teacherLimit:number;scope:"manager-tier"};
type Manager={deviceId:string;deviceCode:string;personCode:string;name:string;approved:boolean;managementEnabled:boolean};
type Invoke=(payload:Record<string,unknown>)=>Promise<Record<string,unknown>>;

export default function BoiManagerGrants({invoke,managers}:{invoke:Invoke;managers:Manager[]}){
 const [limits,setLimits]=useState<Limits|null>(null);
 const [learner,setLearner]=useState("50");
 const [teacher,setTeacher]=useState("5");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [fault,setFault]=useState(false);
 const lock=useRef(false);
 const refresh=useCallback(async()=>{
   if(lock.current)return;
   lock.current=true;setBusy(true);setFault(false);setNotice("");
   try{
     const result=await invoke({action:"get-tier-limits"});
     if(result.scope!=="manager-tier"||!Number.isInteger(result.learnerLimit)||!Number.isInteger(result.teacherLimit))
       throw new Error("D1 chưa xác nhận hạn mức cấp quản lý.");
     const confirmed={scope:"manager-tier" as const,learnerLimit:Number(result.learnerLimit),teacherLimit:Number(result.teacherLimit)};
     setLimits(confirmed);setLearner(String(confirmed.learnerLimit));setTeacher(String(confirmed.teacherLimit));
   }catch(e){setFault(true);setNotice(e instanceof Error?e.message:"Không đọc được D1.");}
   finally{lock.current=false;setBusy(false)}
 },[invoke]);
 useEffect(()=>{void refresh()},[refresh]);
 async function saveLimits(){
   if(lock.current)return;
   const l=Number(learner),t=Number(teacher);
   if(!/^\d+$/.test(learner)||!/^\d+$/.test(teacher)||!Number.isInteger(l)||!Number.isInteger(t)||l>5000||t>500){
     setFault(true);setNotice("Giới hạn học viên 0–5000, giảng viên 0–500; chỉ nhập số nguyên.");return;
   }
   lock.current=true;setBusy(true);setNotice("");setFault(false);
   try{
     await invoke({action:"set-tier-limits",learnerLimit:l,teacherLimit:t});
     const verified=await invoke({action:"get-tier-limits"});
     if(verified.scope!=="manager-tier"||verified.learnerLimit!==l||verified.teacherLimit!==t)
       throw new Error("D1 GET độc lập chưa xác nhận hạn mức mới.");
     setLimits({scope:"manager-tier",learnerLimit:l,teacherLimit:t});
     setNotice("Đã lưu và xác minh hạn mức chung từ D1 Bơi Ếch.");
   }catch(e){setFault(true);setNotice(e instanceof Error?e.message:"Chưa xác minh được hạn mức.");}
   finally{lock.current=false;setBusy(false)}
 }
 async function grant(manager:Manager,enabled:boolean){
   if(lock.current)return;
   if(!manager.approved&&enabled){setFault(true);setNotice("Cán bộ phải được Owner duyệt tài khoản trước.");return;}
   if(!manager.personCode){setFault(true);setNotice("Thiếu mã cán bộ để đối chiếu.");return;}
   if(!window.confirm((enabled?"Cấp":"Thu hồi")+" quyền quản lý cho "+manager.deviceCode+"?"))return;
   lock.current=true;setBusy(true);setFault(false);setNotice("");
   try{
     const written=await invoke({action:"grant-manager",deviceId:manager.deviceId,expectedPersonCode:manager.personCode,enabled});
     if(written.managementEnabled!==enabled)throw new Error("Lệnh chưa xác nhận quyền cán bộ.");
     // Independent new authority read: do not treat the POST receipt as sole evidence.
     const read=await invoke({action:"get-manager-grant",deviceId:manager.deviceId,expectedPersonCode:manager.personCode});
     if(read.managementEnabled!==enabled)throw new Error("D1 GET độc lập chưa xác minh quyền cán bộ.");
     setNotice(enabled?"Đã cấp quyền cán bộ và xác minh D1.":"Đã thu hồi quyền cán bộ và xác minh D1.");
   }catch(e){setFault(true);setNotice(e instanceof Error?e.message:"Chưa xác minh được quyền.");}
   finally{lock.current=false;setBusy(false)}
 }
 return <section aria-label="Cấp quyền cán bộ quản lý Bơi Ếch" style={{padding:18,border:"1px solid var(--border, #567)",borderRadius:12,margin:"18px 0"}}>
   <header style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
     <div><h2>Cấp quyền cán bộ quản lý</h2><p>Chỉ Owner xét duyệt cán bộ. Học viên và giảng viên do cán bộ Bơi Ếch duyệt.</p></div>
     <button type="button" disabled={busy} onClick={()=>void refresh()}>Đọc hạn mức LIVE</button>
   </header>
   <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
     <label>Học viên (toàn cấp)<input aria-label="Hạn mức chung học viên" type="number" min={0} max={5000} value={learner} onChange={e=>setLearner(e.target.value)} disabled={busy||!limits}/></label>
     <label>Giảng viên (toàn cấp)<input aria-label="Hạn mức chung giảng viên" type="number" min={0} max={500} value={teacher} onChange={e=>setTeacher(e.target.value)} disabled={busy||!limits}/></label>
     <button type="button" disabled={busy||!limits} onClick={()=>void saveLimits()}>Lưu hạn mức chung</button>
   </div>
   <p>Áp dụng chung cho tất cả cán bộ, không nhân theo số cán bộ. {limits?"D1 LIVE: "+limits.learnerLimit+" học viên / "+limits.teacherLimit+" giảng viên.":"Chưa có readback D1."}</p>
   {notice?<p role={fault?"alert":"status"}>{notice}</p>:null}
   <div>{managers.map(m=><div key={m.deviceId} style={{display:"flex",justifyContent:"space-between",gap:12,padding:10,borderTop:"1px solid #999"}}>
     <div><strong>{m.name||m.deviceCode}</strong><p>{m.deviceCode} · {m.personCode} · {m.approved?"Tài khoản đã duyệt":"Chưa duyệt tài khoản"} · {m.managementEnabled?"Được quản lý":"Chưa cấp quản lý"}</p></div>
     <button type="button" disabled={busy||!m.approved} onClick={()=>void grant(m,!m.managementEnabled)}>{m.managementEnabled?"Thu hồi quyền":"Cấp quyền"}</button>
   </div>)}</div>
   {!managers.length?<p>Chưa có hồ sơ cán bộ được xác minh từ Bơi Ếch.</p>:null}
 </section>;
}

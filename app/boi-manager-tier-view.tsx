"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {operationsAction} from "./admin-device-client";
import styles from "./boi-manager-tier-view.module.css";

type ManagerRecord={
  deviceId:string;deviceCode:string;name:string;personCode:string;
  status:"pending"|"approved"|"blocked"|"unknown";
  registrationComplete:boolean;managementEnabled:boolean;accessExpired:boolean;
  paymentStatus:string;accessGroup:string;
};
type ManagerResponse={
  ok?:boolean;error?:string;managers?:ManagerRecord[];learnerLimit?:number;teacherLimit?:number;
};
export default function BoiManagerTierView(){
  const [data,setData]=useState<ManagerResponse|null>(null);
  const [limits,setLimits]=useState({learnerLimit:50,teacherLimit:5});
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState(false);
  const lock=useRef(false);
  const mounted=useRef(true);
  const reload=useCallback(async()=>{
    const response=await operationsAction({action:"boi-manager-tier",operation:"list"}) as unknown as ManagerResponse;
    if(response.ok!==true||!Array.isArray(response.managers)
      ||!Number.isInteger(response.learnerLimit)||!Number.isInteger(response.teacherLimit))
      throw new Error("Chưa xác minh được danh sách và hạn mức cán bộ từ D1 Bơi Ếch.");
    if(mounted.current){setData(response);setLimits({
      learnerLimit:response.learnerLimit!,teacherLimit:response.teacherLimit!
    });}
  },[]);
  useEffect(()=>{
    mounted.current=true;
    void reload().catch(e=>{if(mounted.current){setError(true);setMessage(e instanceof Error?e.message:"Chưa kết nối được Bơi Ếch.");}});
    return()=>{mounted.current=false;};
  },[reload]);
  async function submit(operation:"approve-account"|"grant-manager"|"revoke-manager"|"set-tier-limits",device?:ManagerRecord){
    if(lock.current)return;
    if(device&&!window.confirm(
      operation==="approve-account"?"Duyệt tài khoản và cấp quyền Cán bộ quản lý cho "+device.deviceCode+"?"
        :operation==="grant-manager"?"Cấp quyền Cán bộ quản lý cho "+device.deviceCode+"?"
        :"Thu hồi quyền Cán bộ quản lý "+device.deviceCode+"?"))return;
    lock.current=true;setBusy(true);setError(false);setMessage("");
    try{
      const r=await operationsAction({action:"boi-manager-tier",operation,
        ...(device?{deviceId:device.deviceId,deviceCode:device.deviceCode,
          expectedPersonCode:device.personCode,expectedManagementEnabled:device.managementEnabled}
          :{...limits,expectedLearnerLimit:data?.learnerLimit,
            expectedTeacherLimit:data?.teacherLimit})
      }) as unknown as ManagerResponse;
      if(r.ok!==true)throw new Error(r.error||"Bơi Ếch chưa xác nhận thay đổi.");
      await reload();
      setMessage("Đã thao tác và đọc lại quyền/hạn mức từ ứng dụng nguồn.");
    }catch(e){setError(true);setMessage(e instanceof Error?e.message:"Thao tác chưa được xác minh. Hãy đồng bộ lại.");}
    finally{lock.current=false;setBusy(false);}
  }
  const managers=data?.managers??[];
  return <section className={styles.root}>
    <header><div><h2>Cán bộ quản lý · Bơi Ếch</h2>
      <p>App-Manager chỉ xét duyệt tài khoản Cán bộ quản lý và thiết lập hạn mức chung.
        Học viên và giảng viên được cán bộ đã cấp quyền xét duyệt trong Bơi Ếch.</p></div>
      <button type="button" disabled={busy} onClick={()=>{void reload().then(()=>{setError(false);setMessage("Đã đồng bộ quyền quản lý LIVE.");})
        .catch(e=>{setError(true);setMessage(e instanceof Error?e.message:"Không thể đồng bộ.");});}}>Đồng bộ</button>
    </header>
    {message?<p role={error?"alert":"status"} className={error?styles.error:styles.notice}>{message}</p>:null}
    <section className={styles.limits}><h3>Hạn mức chung của cấp Cán bộ quản lý</h3>
      <p>Không nhân hạn mức theo số lượng cán bộ. Chỉ Chủ hệ thống được sửa.</p>
      <div className={styles.controls}>
        <label>Học viên tối đa<input type="number" min={0} max={5000} step={1}
          value={limits.learnerLimit} disabled={busy||!data}
          onChange={e=>setLimits(x=>({...x,learnerLimit:Number(e.target.value)}))}/></label>
        <label>Giảng viên tối đa<input type="number" min={0} max={500} step={1}
          value={limits.teacherLimit} disabled={busy||!data}
          onChange={e=>setLimits(x=>({...x,teacherLimit:Number(e.target.value)}))}/></label>
        <button type="button" disabled={busy||!data||!Number.isInteger(limits.learnerLimit)
          ||!Number.isInteger(limits.teacherLimit)||limits.learnerLimit<0||limits.learnerLimit>5000
          ||limits.teacherLimit<0||limits.teacherLimit>500}
          onClick={()=>void submit("set-tier-limits")}>Lưu hạn mức & đọc lại</button>
      </div>
    </section>
    <section><h3>Quyền tài khoản Cán bộ quản lý</h3>
      {!data?<p>Chưa xác minh kết nối dữ liệu Bơi Ếch.</p>:null}
      {data&&!managers.length?<p>Không có hồ sơ Cán bộ quản lý.</p>:null}
      {managers.map(m=><article key={m.deviceId} className={styles.manager}>
        <div><strong>{m.name||"Chưa có tên"} · {m.deviceCode}</strong>
          <small>{m.personCode} · {m.status==="approved"?"Tài khoản đã duyệt":m.status==="pending"?"Đang chờ":"Đã khóa"}</small>
          <small>{m.managementEnabled?"Đã có quyền Cán bộ quản lý":"Chưa được cấp quyền điều phối"}</small>
        </div>
        <div className={styles.actions}>
          {m.status==="pending"?<button disabled={busy||!m.registrationComplete||m.paymentStatus!=="unassigned"}
            onClick={()=>void submit("approve-account",m)}>Duyệt &amp; cấp quyền</button>:null}
          {m.status==="approved"&&!m.managementEnabled?<button disabled={busy||m.accessExpired}
            onClick={()=>void submit("grant-manager",m)}>Cấp quyền Cán bộ</button>:null}
          {m.managementEnabled?<button type="button" disabled={busy}
            onClick={()=>void submit("revoke-manager",m)}>Thu hồi quyền Cán bộ</button>:null}
        </div>
      </article>)}
    </section>
    <p>Chế độ xem thử Cán bộ quản lý có tại ứng dụng Bơi Ếch, chỉ sử dụng dữ liệu mẫu và không có quyền ghi.</p>
  </section>;
}

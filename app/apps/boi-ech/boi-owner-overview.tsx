"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {useBoiSyncNotices} from "./manual-sync-notices";
import {loadBoiAccountDurations,loadBoiManagerInbox,
  type BoiAccountDurationRecord,type BoiManagerInboxRecord} from "../../boi-access-client";

type OwnerSection="accounts"|"oversight"|"policies"|"devices"|"reports";
const roleLabel:Record<string,string>={manager:"Cán bộ quản lý",teacher:"Giảng viên",learner:"Học viên"};
const stageLabel:Record<string,string>={
  requested:"Chờ người phụ trách duyệt",profile_required:"Đã duyệt · Chờ hoàn thiện hồ sơ",
  profile_review:"Hồ sơ cũ · Cần đối soát",changes_requested:"Cần bổ sung hồ sơ",
  active:"Đang hoạt động",suspended:"Tạm khóa",archived:"Đã lưu trữ"
};
type VerifiedSnapshot={accounts:BoiAccountDurationRecord[];managers:BoiManagerInboxRecord[];nextCursor:string|null};
export default function BoiOwnerOverview({onNavigate}: {onNavigate:(section:OwnerSection)=>void}) {
  const [snapshot,setSnapshot]=useState<VerifiedSnapshot|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [revision,setRevision]=useState(0);
  const {count:unread,ids:unreadIds,acknowledge}=useBoiSyncNotices("owner");
  const awaitingManualAck=useRef<string[]|null>(null);
  useEffect(()=>{
    let cancelled=false;
    Promise.all([loadBoiAccountDurations(),loadBoiManagerInbox()]).then(([records,queue])=>{
      if(cancelled)return;
      setSnapshot({accounts:records.accounts,managers:queue.managers,nextCursor:queue.nextCursor});
      setError("");setLoading(false);
      if(awaitingManualAck.current){
        acknowledge(awaitingManualAck.current);
        awaitingManualAck.current=null;
      }
    }).catch(caught=>{
      if(cancelled)return;
      setSnapshot(null);
      awaitingManualAck.current=null; // keep the badge: readback did not succeed
      setError(caught instanceof Error?caught.message:"Chưa thể xác minh dữ liệu tài khoản Bơi Ếch.");
      setLoading(false);
    });
    return ()=>{cancelled=true;};
  },[revision,acknowledge]);

  const stats=useMemo(()=>{
    if(!snapshot)return null;
    const tally=(role:string)=>snapshot.accounts.filter(a=>a.role===role).length;
    return {total:snapshot.accounts.length,managers:tally("manager"),
      teachers:tally("teacher"),learners:tally("learner"),
      pending:snapshot.managers.filter(m=>m.status==="pending"
        && m.onboardingStage==="requested").length};
  },[snapshot]);
  const pendingManagers=snapshot?.managers.filter(m=>m.status==="pending"
    && m.onboardingStage==="requested") ?? [];
  const pendingLearners=snapshot?.accounts.filter(a=>(a.role==="teacher" || a.role==="learner")
    && ["requested","profile_required","profile_review","changes_requested"].includes(a.onboardingStage??"")).slice(0,5)??[];
  const label=(value:number|undefined)=>stats?Number(value).toLocaleString("vi-VN"):"—";

  return <div className="boi-owner-dashboard" aria-label="Tổng quan tài khoản Bơi Ếch">
    <div className="boi-owner-dashboard-head">
      <div><span>ACCOUNT-FIRST V2 · OWNER MONITORING</span>
        <h2>Quản trị tài khoản Bơi Ếch</h2>
        <p>Owner duyệt <strong>cán bộ quản lý</strong>; giảng viên và học viên hiển thị để giám sát, không cấp quyền từ đây.</p>
      </div>
      <button type="button" className="boi-manual-sync-control"
        onClick={()=>{awaitingManualAck.current=[...unreadIds];setSnapshot(null);setError("");setLoading(true);setRevision(v=>v+1);}}
        disabled={loading} aria-label={unread>0?`Đồng bộ thủ công ${unread} thông báo chờ`:"Đồng bộ dữ liệu thủ công"}>
        {loading?"Đang đồng bộ…":"↻ Đồng bộ dữ liệu"}
        {unread>0?<span className="boi-manual-sync-badge" aria-hidden="true">{unread>99?"99+":unread}</span>:null}
      </button>
    </div>
    {error?<div className="boi-owner-error" role="alert">
      <strong>Chưa xác minh được dữ liệu tài khoản.</strong> {error}
      <p>Không quy đổi lỗi kết nối thành 0 tài khoản hoặc 0 yêu cầu.</p>
    </div>:null}
    <section className="boi-account-metrics" aria-label="Tài khoản đã xác minh">
      <article><span className="boi-metric-icon blue">♙</span><div><small>Tổng tài khoản</small><strong>{label(stats?.total)}</strong><span>Toàn bộ vai trò · nguồn Bơi Ếch</span></div></article>
      <article><span className="boi-metric-icon green">♟</span><div><small>Cán bộ quản lý</small><strong>{label(stats?.managers)}</strong><span>Owner kiểm duyệt</span></div></article>
      <article><span className="boi-metric-icon violet">◆</span><div><small>Giảng viên</small><strong>{label(stats?.teachers)}</strong><span>Giám sát · không cấp quyền</span></div></article>
      <article><span className="boi-metric-icon sky">●</span><div><small>Học viên</small><strong>{label(stats?.learners)}</strong><span>Giám sát · không cấp quyền</span></div></article>
      <article><span className="boi-metric-icon amber">◷</span><div><small>Cán bộ chờ duyệt</small><strong>{label(stats?.pending)}</strong><span>{snapshot?.nextCursor?"Còn trang tiếp theo":"Hàng chờ Owner"}</span></div></article>
    </section>
    <div className="boi-owner-grid">
      <div className="boi-owner-stack">
        <section className="boi-console-card">
          <header><div><span>CHỜ OWNER XỬ LÝ</span><h3>Danh sách cán bộ chờ duyệt {stats?<em>({stats.pending}{snapshot?.nextCursor?"+":""})</em>:null}</h3></div>
            <button type="button" onClick={()=>onNavigate("accounts")}>Xem tất cả →</button></header>
          {!snapshot?<p className="boi-no-data">{loading?"Đang đọc hàng chờ từ Bơi Ếch…":"Hàng chờ chưa được xác minh."}</p>
           :pendingManagers.length? <div className="boi-owner-table-scroll"><table className="boi-owner-table">
             <thead><tr><th>Cán bộ đăng ký</th><th>Trạng thái</th><th>Quy trình</th><th>Hành động</th></tr></thead>
             <tbody>{pendingManagers.slice(0,4).map(m=><tr key={m.accountId}>
               <td><strong>{m.name||"Hồ sơ chưa hoàn thiện"}</strong><small>{m.accountId.slice(0,18)}…</small></td>
               <td><span className="boi-status-tag waiting">Đang chờ</span></td>
               <td>{stageLabel[m.onboardingStage]??m.onboardingStage}</td>
               <td><button type="button" onClick={()=>onNavigate("accounts")}>Mở duyệt →</button></td>
             </tr>)}</tbody></table></div>
           :<p className="boi-no-data">Không có hồ sơ cán bộ cần duyệt trong {snapshot.nextCursor?"trang đã tải":"danh sách đã xác minh"}.</p>}
        </section>
        <section className="boi-console-card">
          <header><div><span>GIÁM SÁT · KHÔNG CẤP QUYỀN</span><h3>Giảng viên & học viên đang tiếp nhận</h3></div>
            <button type="button" onClick={()=>onNavigate("oversight")}>Giám sát tất cả →</button></header>
          {!snapshot?<p className="boi-no-data">Chưa có dữ liệu được xác minh.</p>:
           pendingLearners.length?<div className="boi-owner-table-scroll"><table className="boi-owner-table">
            <thead><tr><th>Họ tên</th><th>Vai trò</th><th>Trạng thái</th><th>Phụ trách</th></tr></thead><tbody>
            {pendingLearners.map(a=><tr key={a.accountId}><td><strong>{a.name||"Chưa khai báo"}</strong><small>{a.accountId.slice(0,18)}…</small></td>
              <td>{roleLabel[a.role]||a.role}</td><td>{stageLabel[a.onboardingStage||""]||a.onboardingStage||"Chưa rõ"}</td>
              <td><span className="boi-status-tag neutral">Cán bộ quản lý</span></td></tr>)}
            </tbody></table></div>:<p className="boi-no-data">Không có hồ sơ giảng viên/học viên ở trạng thái tiếp nhận trong tập đã tải.</p>}
          <footer>Chỉ xem trạng thái. Không có nút duyệt, từ chối, cấp hoặc thu hồi quyền đối với giảng viên/học viên.</footer>
        </section>
      </div>
      <aside className="boi-owner-rail">
        <section className="boi-console-card boi-owner-actions">
          <h3>⚡ Thao tác nhanh</h3>
          <button type="button" className="primary" onClick={()=>onNavigate("accounts")}>＋ Duyệt cán bộ quản lý</button>
          <button type="button" onClick={()=>onNavigate("accounts")}>＋ Mời cán bộ quản lý (mã một lần)</button>
          <button type="button" onClick={()=>onNavigate("policies")}>◷ Thời hạn & chính sách</button>
          <button type="button" onClick={()=>onNavigate("oversight")}>♙ Giám sát học viên, giảng viên</button>
          <button type="button" onClick={()=>onNavigate("reports")}>▥ Báo cáo thiết bị</button>
        </section>
        <section className="boi-console-card boi-owner-role-legend"><h3>Ranh giới phân quyền</h3>
          <div><span className="boi-metric-icon amber">★</span><p><strong>Owner · App-Management</strong><small>Mời, duyệt một lần và quản lý chính sách cán bộ</small></p></div>
          <div><span className="boi-metric-icon blue">♙</span><p><strong>Cán bộ quản lý</strong><small>Duyệt giáo viên/học viên theo scope</small></p></div>
          <div><span className="boi-metric-icon violet">◆</span><p><strong>Giảng viên</strong><small>Thực hiện giảng dạy, không duyệt tài khoản</small></p></div>
          <div><span className="boi-metric-icon sky">●</span><p><strong>Học viên</strong><small>Học tập và quản lý dữ liệu cá nhân</small></p></div>
        </section>
      </aside>
    </div>
  </div>;
}

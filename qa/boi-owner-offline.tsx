import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import BoiEchControlCenter from '../app/apps/boi-ech/boi-ech-control-center';
import shell from '../app/apps/boi-ech/boi-ech-shell.module.css';
import '../app/globals.css';
import './owner-offline.css';
import {installOfflineTransport,lab} from './owner-offline-transport';

installOfflineTransport();
function OfflineReview(){
 const [version,setVersion]=useState(0),[note,setNote]=useState(''),[showAudit,setShowAudit]=useState(false),[auditVersion,setAuditVersion]=useState(0);
 useEffect(()=>{
  const changed=()=>setAuditVersion(v=>v+1),notice=(event:Event)=>setNote(String((event as CustomEvent).detail));
  window.addEventListener('offline-audit',changed);window.addEventListener('offline-link',notice);
  return()=>{window.removeEventListener('offline-audit',changed);window.removeEventListener('offline-link',notice);};
 },[]);
 const reboot=()=>setVersion(v=>v+1);
 return <><aside className="offline-lab" aria-label="Bản kiểm tra offline">
  <div><b>OFFLINE REVIEW</b><strong>Owner Console · Bơi Ếch AI</strong><span>Dữ liệu mẫu · Không kết nối máy chủ · MFA mẫu: 000000</span></div>
  <div className="offline-lab-actions">
   <button onClick={()=>{lab.reset();reboot();setNote('Đã đặt lại dữ liệu mẫu; không thay đổi tài khoản thật.');}}>Đặt lại mẫu</button>
   <button aria-pressed={!lab.connected()} onClick={()=>{lab.setConnection(!lab.connected());reboot();setNote(lab.connected()?'Đã khôi phục kết nối mẫu.':'Đang mô phỏng lỗi kết nối. Số liệu phải hiện chưa xác minh.');}}>Lỗi kết nối</button>
   <button onClick={()=>{lab.conflict();setNote('Thao tác lưu tiếp theo sẽ gặp xung đột 409; cần đọc lại revision.');}}>Thử xung đột 409</button>
   <button onClick={()=>{lab.uncertain();setNote('Lần lưu thời hạn tiếp theo mô phỏng đã gửi nhưng chưa đọc lại được; không được báo thành công.');}}>Thử lỗi đọc lại</button>
   <button onClick={()=>{lab.resetMfa();setNote('Lần lưu tiếp theo sẽ yêu cầu MFA mẫu 000000. Không dùng mã Authenticator thật.');}}>Thử MFA</button>
   <button onClick={()=>setShowAudit(v=>!v)} aria-expanded={showAudit}>Nhật ký mẫu</button>
  </div>
  {note?<p role="status">{note}</p>:null}
  {showAudit?<div className="offline-audit" data-revision={auditVersion}><strong>Nhật ký mô phỏng trên trình duyệt</strong>{lab.audit().length?lab.audit().map((a,i)=><p key={i}>{new Date(a.at).toLocaleTimeString('vi-VN')} · {a.action} · rev {a.revision}</p>):<p>Chưa có thay đổi mẫu.</p>}</div>:null}
 </aside><div className={shell.scope} key={version}><BoiEchControlCenter user={{displayName:'Owner · dữ liệu mẫu',email:'owner@example.invalid'}}/></div></>;
}
createRoot(document.getElementById('root')!).render(<OfflineReview/>);

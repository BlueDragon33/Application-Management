"use client";

import { useState } from "react";
import {
  runRussianDailyActiveNextAction,
  type RussianDailyActiveRunReceipt
} from "./actions";

export default function RussianDailyNextAction() {
  const [running,setRunning] = useState(false);
  const [receipt,setReceipt] = useState<RussianDailyActiveRunReceipt|null>(null);
  const [failure,setFailure] = useState("");
  const [explain,setExplain] = useState(false);

  async function execute() {
    if(running) return;
    setRunning(true);
    setReceipt(null);
    setFailure("");
    try {
      const next = await runRussianDailyActiveNextAction();
      if (next.grantedPrivileges || next.developerApproval || next.hasDeployedSite ||
          next.actionId !== "RD-ACTIVE-E2E-PREFLIGHT-V1" ||
          !next.steps.length) {
        setFailure("Biên nhận vượt quyền hoặc thiếu bằng chứng; dừng ở trạng thái BLOCKED.");
        return;
      }
      setReceipt(next);
    } catch(error) {
      setFailure(error instanceof Error ? error.message : "Lỗi server action; chưa thể hoàn tất kiểm tra.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section aria-label="Active Next Action Blueprint OS 1.3.0" style={{ marginTop:22,border:"1px solid #859ab0",borderRadius:16,padding:18 }}>
      <h2 style={{marginTop:0}}>ACTIVE NEXT ACTION · Thực thi một lần bấm</h2>
      <p style={{fontSize:14}}>
        Chạy liên tục toàn bộ kiểm tra được cấp quyền; chỉ dừng ở cổng quyền thực,
        không chuyển sang Vercel rồi yêu cầu bấm lại.
      </p>
      <button type="button" disabled={running} onClick={() => void execute()}
        aria-busy={running}
        style={{width:"100%",minHeight:54,border:"none",borderRadius:12,padding:"14px 16px",
          background:running?"#50647a":"#145d85",color:"#fff",fontWeight:750,
          cursor:running?"wait":"pointer"}}>
        {running ? "ĐANG THỰC THI LIÊN TỤC — KHÔNG CẦN BẤM LẠI" : "ACTIVE NEXT ACTION — THỰC HIỆN"}
      </button>
      {running ? <p role="status">Đang nhận và kiểm tra bằng chứng từ server, không tạo thêm phiên thực thi.</p> : null}
      {failure ? <p role="alert" style={{color:"#b42318"}}>{failure}</p> : null}
      {receipt ? (
        <section aria-label="Biên nhận thực thi" style={{marginTop:16}}>
          <p><strong>Kết quả: {receipt.status}</strong></p>
          <p style={{fontSize:12}}>Mã nguồn: {receipt.sourceRevision.slice(0,12)} · Kiểm tra lúc {receipt.observedAt}</p>
          <ol style={{paddingLeft:22}}>
            {receipt.steps.map(s=>(
              <li key={s.key} style={{marginBottom:12}}>
                <strong>{s.title} — {s.result}</strong>
                <div style={{fontSize:13}}>{s.evidence}</div>
              </li>
            ))}
          </ol>
          <p><strong>Một bước cần quyền tiếp theo:</strong> {receipt.oneNextAction}</p>
        </section>
      ) : null}
      <button type="button" aria-expanded={explain} aria-controls="russian-daily-active-help"
        onClick={()=>setExplain(!explain)}
        style={{marginTop:12,minHeight:44,borderRadius:10,padding:"9px 14px",border:"1px solid #8296ab",background:"transparent",color:"inherit"}}>
        {explain?"Thu gọn giải thích":"TRỢ GIÚP · Quyền hạn & cách hoạt động"}
      </button>
      {explain ? <div id="russian-daily-active-help" style={{marginTop:10,fontSize:13}}>
        <p>Nút chạy tất cả bước đọc/kiểm tra nguồn đang được quyền dùng trong một server action; kết quả trả về cuối một lần, không bắt đăng nhập lại giữa từng bước.</p>
        <p>Chỉ khi có Vercel/GitHub issuer và connector chính thức mới có thể bổ sung triển khai Preview tự động. Không thể biến một nút trình duyệt thành quyền deploy, dùng API bí mật hoặc tự duyệt PR.</p>
        <p>Ứng dụng Russian Daily độc lập có bộ Next Action riêng để xử lý lịch, xuất .ics và kiểm tra dữ liệu cục bộ. Trang này chỉ điều phối quản trị.</p>
      </div> : null}
    </section>
  );
}

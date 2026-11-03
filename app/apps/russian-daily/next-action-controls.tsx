"use client";

import { useState } from "react";
import { runRussianDailyNextAction, type RussianDailyNextActionReceipt } from "./actions";

export default function RussianDailyNextAction() {
  const [working, setWorking] = useState(false);
  const [details, setDetails] = useState(false);
  const [receipt, setReceipt] = useState<RussianDailyNextActionReceipt | null>(null);
  const [failure, setFailure] = useState("");

  async function executeEntireAuthorizedChain() {
    if (working) return;
    setWorking(true);
    setFailure("");
    setReceipt(null);
    try {
      // One user action invokes the whole available server-side preflight chain.
      // No intermediary "Continue", page navigation, timer or repeated prompts.
      const result = await runRussianDailyNextAction();
      if (result.contractVersion !== "russian-daily-one-click/v1" ||
          result.actionId !== "RD-ONE-CLICK-READONLY-PREFLIGHT" ||
          result.privilegedExecution || result.workPackageExecution ||
          result.projectAuthority !== "UNVERIFIED" ||
          result.state !== "BLOCKED_EXTERNAL_GATE") {
        throw new Error("Biên nhận không đúng hợp đồng quyền. Không sử dụng kết quả.");
      }
      setReceipt(result);
      setDetails(true);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Lỗi thực thi. Không xác nhận thành công.");
    } finally {
      setWorking(false);
    }
  }

  const verifiedCount = receipt?.steps.filter(step => step.state === "VERIFIED_LOCAL").length ?? 0;
  const totalCount = receipt?.steps.length ?? 0;
  return (
    <section aria-label="Next Action — bộ thực thi có kiểm soát"
      style={{marginTop:20,border:"1px solid #8393a7",borderRadius:16,padding:18}}>
      <h2 style={{marginTop:0}}>NEXT ACTION · Thực thi một lần bấm</h2>
      <p>Không phải đường dẫn hướng dẫn: nút này chạy liên tiếp toàn bộ bước kiểm tra <strong>đã được phép</strong>, rồi trả về biên nhận và cổng chặn cụ thể.</p>
      <button type="button" onClick={() => void executeEntireAuthorizedChain()}
        disabled={working} aria-busy={working}
        style={{width:"100%",minHeight:54,padding:14,border:0,borderRadius:12,
          background:"#145d85",color:"#ffffff",fontWeight:750,cursor:working?"progress":"pointer"}}>
        {working ? "ĐANG CHẠY CHUỖI KIỂM TRA…" : "KÍCH HOẠT NEXT ACTION — CHẠY LIÊN TỤC"}
      </button>
      <p role="status" aria-live="polite" style={{marginTop:12}}>
        {working ? "Đang xác thực phiên và kiểm tra toàn bộ điều kiện kỹ thuật trong phạm vi được cấp…" :
         failure ? "DỪNG AN TOÀN: " + failure :
         receipt ? "Đã hoàn thành " + verifiedCount + "/" + totalCount + " bước đọc nội bộ; các bước cần quyền ngoài vẫn BLOCKED." :
         "Chưa chạy. Trạng thái ứng dụng hiện tại: SOURCE CANDIDATE — REVIEW BLOCKED."}
      </p>
      {receipt ? (
        <div style={{marginTop:14}}>
          <p><strong>Trạng thái:</strong> {receipt.state} · Không deploy, không merge, không tự APPROVE.</p>
          <p><strong>Cổng chặn thật:</strong> {receipt.blocker}</p>
          <p><strong>Một Next Action tiếp theo:</strong> {receipt.oneNextAction}</p>
          <button type="button" aria-controls="russian-daily-execution-log" aria-expanded={details}
            onClick={() => setDetails(value => !value)}
            style={{minHeight:44,border:"1px solid #8393a7",borderRadius:10,padding:"8px 12px",background:"transparent",color:"inherit"}}>
            {details ? "Ẩn nhật ký 8 bước" : "Xem nhật ký 8 bước"}
          </button>
          {details ? (
            <ol id="russian-daily-execution-log" style={{paddingLeft:24}}>
              {receipt.steps.map(step => (
                <li key={step.id} style={{marginBottom:12}}>
                  <strong>{step.label}</strong> — {step.state}
                  <div style={{fontSize:13,opacity:0.85}}>{step.evidence}</div>
                </li>
              ))}
            </ol>
          ) : null}
          <p style={{fontSize:12,opacity:0.8}}>Biên nhận chỉ tồn tại trong phiên giao diện hiện tại, chưa phải nhật ký executor bền vững hoặc bằng chứng GitHub CI/Safari/Vercel.</p>
          <a href="https://vercel.com/account" target="_blank" rel="noopener noreferrer">
            Xem tài khoản Vercel khi cần cấp quyền
          </a>
        </div>
      ) : null}
      <p style={{fontSize:12,opacity:0.8}}>
        Blueprint OS 1.3.0: cổng PROJECT_READ/issuer, QA và Production không được tự vượt qua.
        Không dùng GitHub-hosted Actions, shell đặc quyền, thanh toán hay API dịch vụ chưa kết nối.
      </p>
    </section>
  );
}

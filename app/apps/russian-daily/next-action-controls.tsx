"use client";

import { useState } from "react";
import { prepareRussianDailyNextAction, type RussianDailyNextActionReceipt } from "./actions";

const CMD = "node --test web/russian-daily/tests/source-contract.test.mjs";

export default function RussianDailyNextAction() {
  const [guide, setGuide] = useState(false);
  const [showCmd, setShowCmd] = useState(false);
  const [cmdOutput, setCmdOutput] = useState("");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [receipt, setReceipt] = useState<RussianDailyNextActionReceipt | null>(null);

  async function runNextAction() {
    if (working) return;
    setWorking(true);
    setNotice("");
    try {
      const next = await prepareRussianDailyNextAction();
      setReceipt(next);
      // This is a single user-authorized navigation to a known provider page;
      // it does NOT deploy or verify subscription status on the user's behalf.
      if (next.status !== "SAFE_NAVIGATION_ONLY" || next.privilegedExecution ||
          next.projectAuthority !== "UNVERIFIED" || next.providerUrl !== "https://vercel.com/account") {
        setNotice("Có thay đổi ngoài hợp đồng read-only. Dừng lại để kiểm tra.");
        return;
      }
      setNotice("Chỉ mở trang tài khoản Vercel để bạn kiểm tra Hobby/quota. Chưa thực hiện deploy.");
      window.location.assign(next.providerUrl);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể xác minh lại phiên đăng nhập. Không thực thi nhiệm vụ.");
    } finally {
      setWorking(false);
    }
  }

  const qaHint = cmdOutput.trim()
    ? "Đã nhận " + cmdOutput.length + " ký tự trên thiết bị. Chỉ là dữ liệu người dùng dán, CHƯA XÁC MINH nguồn hoặc CI PASS."
    : "Nếu nhiệm vụ thực sự yêu cầu CMD trên Windows, dán kết quả sau khi chạy kiểm thử. Nội dung chỉ được đọc trên thiết bị, không tự gửi lên server.";

  return (
    <section aria-label="Blueprint OS 1.3.0 — Next Action" style={{ marginTop: 22, border: "1px solid #8a9baa", borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0 }}>NEXT ACTION · Hỗ trợ theo Hiến pháp</h2>
        <span style={{ fontSize: 12 }}>CANDIDATE · REVIEW BLOCKED</span>
      </div>
      <p><strong>Một bước tiếp theo:</strong> Kiểm tra tài khoản Vercel Hobby và hạn mức trước khi tạo Preview.</p>
      <p style={{ fontSize: 13, opacity: .85 }}>Nguồn: Bauman-Russian-iOS tại SHA b92a4d68. Hiện chưa có Site riêng hoặc quyền phát hành.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
        <button
          type="button"
          disabled={working}
          onClick={() => void runNextAction()}
          style={{ minHeight: 48, border: "none", borderRadius: 12, padding: "12px 16px", background: "#145d85", color: "white", fontWeight: 700, cursor: "pointer" }}
        >
          {working ? "Đang kiểm tra quyền và lập bước an toàn…" : "NEXT ACTION — TỰ LẬP KẾ HOẠCH & XỬ LÝ"}
        </button>
        <button
          type="button"
          aria-expanded={guide}
          aria-controls="russian-daily-next-guide"
          onClick={() => setGuide(value => !value)}
          style={{ minHeight: 44, borderRadius: 12, padding: "10px 14px", border: "1px solid #8094a8", background: "transparent", color: "inherit", cursor: "pointer" }}
        >
          {guide ? "Thu gọn hướng dẫn" : "HƯỚNG DẪN · Vì sao chọn bước này?"}
        </button>
      </div>
      {guide ? (
        <div id="russian-daily-next-guide" style={{ marginTop: 14, borderTop: "1px solid #b7c2cd", paddingTop: 12 }}>
          <p><strong>Định hướng:</strong> Trước tiên xác thực nhà cung cấp và điều kiện miễn phí; sau đó kiểm thử nguồn, Preview có kiểm soát, Safari thật, cuối cùng mới xin reviewer độc lập.</p>
          <p><strong>Bằng chứng cần có:</strong> Hobby/quota thực, phương thức Preview không tự triển khai Production, quyền truy cập repository và bảo vệ preview.</p>
          <p><strong>Giới hạn:</strong> Quyền PROJECT_READ/issuer chưa được chứng minh; nút chỉ tái xác thực phiên quản trị rồi điều hướng đến Vercel, không gọi executor, không chạy Work, không tự deploy/approve/merge.</p>
          <p><strong>Chế độ CMD khi cần QA:</strong> Không bắt buộc ở bước tài khoản. Nếu chuyển sang kiểm thử nguồn trong Windows, mở hỗ trợ dưới đây.</p>
          <button type="button" aria-expanded={showCmd} aria-controls="russian-daily-cmd-help" onClick={() => setShowCmd(v => !v)} style={{ minHeight: 44, padding: "8px 12px", borderRadius: 9 }}>
            {showCmd ? "Ẩn hỗ trợ CMD" : "Hỗ trợ CMD / dán kết quả QA"}
          </button>
          {showCmd ? (
            <div id="russian-daily-cmd-help" style={{ marginTop: 10 }}>
              <p>Đây là lệnh QA nguồn tùy chọn, không chạy tự động. Chỉ dùng trong thư mục gốc của repository khi Node.js đã được cài.</p>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", padding: 12, borderRadius: 10, background: "#152738", color: "#f5f9ff" }}>{CMD}</pre>
              <label htmlFor="russian-daily-cmd-output">Dán đầu ra kiểm thử (không dán token, mật khẩu, khóa riêng)</label>
              <textarea
                id="russian-daily-cmd-output"
                value={cmdOutput}
                onChange={event => setCmdOutput(event.target.value.slice(0, 12000))}
                rows={5}
                style={{ display: "block", width: "100%", marginTop: 8 }}
                placeholder="Dán kết quả Node test tại đây khi có"
              />
              <p role="status">{qaHint}</p>
              <button type="button" onClick={() => setCmdOutput("")}>Xóa nội dung đã dán</button>
            </div>
          ) : null}
          {receipt ? (
            <p><strong>Biên nhận đọc/điều hướng:</strong> {receipt.actionId}, nguồn {receipt.sourceRevision.slice(0, 8)}; {receipt.blockedBy}</p>
          ) : null}
        </div>
      ) : null}
      {notice ? <p role="status" style={{ marginTop: 12 }}>{notice}</p> : null}
      <p style={{ fontSize: 12, opacity: .76 }}>
        “Triển khai từ đầu tới cuối” chỉ mở khi có executor và issuer thực sự được cấp quyền. Không cung cấp nút giả hoặc đường dẫn Work không được xác minh.
      </p>
    </section>
  );
}

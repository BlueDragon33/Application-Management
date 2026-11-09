"use client";

import Link from "next/link";
import { useState } from "react";
import {
  executionRecommendations, foundations, gates, guideProjectName, guideToolName,
  guideVersion, referenceLinks, workflowRules, type GateRisk
} from "./guide-data";
import styles from "./web-app-guide.module.css";

const riskNames: Record<GateRisk,string> = {
  read:"Chỉ đọc", source:"Chỉ mã nguồn", preview:"Preview có kiểm soát",
  human:"Phê duyệt", production:"Production — bảo vệ", monitor:"Sau phát hành"
};

function handoffPrompt() {
  return [
    "DỰ ÁN: " + guideProjectName,
    "Vai trò: Software Architect + QA Lead + Release Safety Auditor dưới Blueprint OS 1.3.0.",
    "Mục tiêu: phát triển công cụ Hướng dẫn lập trình Web-App trong Application-Management; vận hành cẩm nang G0–G8 mà không biến tool thành một cổng deploy hoặc nguồn sự thật mới.",
    "Repo công cụ: BlueDragon33/Application-Management. Route: /tools/web-app-guide. Repo Hiến pháp: BlueDragon33/Software-Blueprint-Hub.",
    "Bảo toàn: giữ nguyên các app/dashboards và toàn bộ sản phẩm Bơi Ếch đã được duyệt trước publish. Không tự merge main, deploy, ghi D1, tạo dịch vụ trả phí hay đụng secret.",
    "Nguồn hiện hành: kiểm tra HEAD và Issues #108 BOIECH_AI, #379 Application-Management; đối chiếu các thay đổi mới hơn trước khi sửa.",
    "Mốc thiết kế Bơi Ếch được chốt: 01fcfed. Mốc App-Management trước PR #381: f347bd0; đây là baseline mã nguồn, không phải xác minh UX trực quan.",
    "Cẩm nang gồm: nền tảng lập trình web-app, G0–G8 từ đóng băng đến readback, danh sách bước, bằng chứng, điều kiện DỪNG và phương án khôi phục.",
    "Điều phối lượt: đọc/đối chiếu G0+G1 có thể gộp; sửa nhỏ và QA G2+G3 có thể gộp khi test PASS; G4 Preview có gate riêng, G5 UX được xác nhận sau; G6 Owner độc lập; G7 Production độc lập; G8 theo dõi ngay và lưu bằng chứng.",
    "Quy tắc Hiến pháp: mỗi lỗi theo vòng tái hiện → sửa nhỏ đúng scope → test + regression → đánh giá. Sau 3 phương án thật sự khác nhau không giải quyết được cùng lỗi, ngừng vá thử, quay lại RCA. Không suy CI PASS = USER ACCEPTED.",
    "Active Next Action: chỉ kiểm tra trạng thái hiện tại, xác định thay đổi nhỏ nhất cần thiết và proof. Kết thúc mỗi lượt ghi base/head SHA, tệp thay đổi, kết quả, BLOCKED, một Next Action. Nếu gặp quyền Cloudflare thật hoặc sự chấp thuận UX/Production, tạo checkpoint ngắn để bàn giao Work/Owner.",
    "Định dạng trả lời: gọn, có DONE/VERIFIED/BLOCKED, không diễn giải lại lịch sử dài. Không làm việc nền, không tự chạy các lệnh ghi Production.",
  ].join("\n");
}

export default function WebAppGuide({ displayName }: { displayName:string }) {
  const [gateId,setGateId] = useState("G0");
  const [phase,setPhase] = useState("inspect");
  const [message,setMessage] = useState("");
  const gate = gates.find(item => item.id === gateId) ?? gates[0];
  const recommendation = executionRecommendations.find(item => item.id === phase) ?? executionRecommendations[0];
  const totalSteps = gates.reduce((count,item) => count + item.steps.length, 0);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(handoffPrompt());
      setMessage("Đã sao chép prompt. Bạn có thể dán vào ChatGPT Project mới.");
    } catch {
      setMessage("Không sao chép được trong trình duyệt này. Hãy chọn và sao chép prompt từ tài liệu bàn giao trong repo.");
    }
  }

  return <main className={styles.shell}>
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>APPLICATION-MANAGEMENT · TOOL · BLUEPRINT OS 1.3.0</p>
          <h1>{guideToolName.split(" · ")[0]}</h1>
          <p className={styles.english}>Web-App Engineering Playbook</p>
          <p>Cẩm nang làm Web-App có kiểm chứng: thiết kế, dữ liệu, QA, Cloudflare Preview, Production và phục hồi. Công cụ <strong>chỉ hướng dẫn và lập kế hoạch</strong>, không thực hiện deploy.</p>
        </div>
        <Link href="/" className={styles.back}>← Trung tâm</Link>
      </header>

      <section className={styles.summary} aria-label="Phạm vi và nguyên tắc">
        <div><small>Cẩm nang</small><strong>{guideVersion}</strong><span>Độc lập với nghiệp vụ các app</span></div>
        <div><small>Cổng an toàn</small><strong>{gates.length} cổng</strong><span>G0 đến G8</span></div>
        <div><small>Các bước tham chiếu</small><strong>{totalSteps} bước</strong><span>Không phải số thao tác bắt buộc</span></div>
        <div><small>Trạng thái</small><strong>Chỉ đọc</strong><span>Không tự suy ra QA PASS</span></div>
      </section>

      <section className={styles.panel}>
        <h2>1. Lộ trình xây dựng Web-App</h2>
        <p className={styles.muted}>Bắt đầu từ bài toán và tính đúng đắn. Chỉ chọn công nghệ hoặc tạo module khi có giá trị thực sự.</p>
        <div className={styles.foundationGrid}>
          {foundations.map((item,index) => <article key={item.title}>
            <span className={styles.number}>{String(index+1).padStart(2,"0")}</span>
            <h3>{item.title}</h3><p>{item.detail}</p>
          </article>)}
        </div>
      </section>

      <section className={styles.panel}>
        <h2>2. Hướng dẫn publish Cloudflare: G0–G8</h2>
        <p className={styles.muted}>Bấm một cổng để xem các bước, bằng chứng và điều kiện buộc phải dừng. Số bước là kế hoạch tham chiếu, không thay thế nghiệm thu.</p>
        <div className={styles.gateNav} aria-label="Chọn cổng triển khai">
          {gates.map(item => <button type="button" key={item.id}
            className={gate.id===item.id?styles.selected:""} aria-pressed={gate.id===item.id}
            onClick={()=>setGateId(item.id)}>
            <strong>{item.id}</strong><span>{item.steps.length} bước</span>
          </button>)}
        </div>
        <div className={styles.gateDetail}>
          <div className={styles.gateHead}>
            <div><span className={styles.eyebrow}>CỔNG {gate.id}</span><h3>{gate.title}</h3></div>
            <span className={styles.risk} data-risk={gate.risk}>{riskNames[gate.risk]}</span>
          </div>
          <p>{gate.objective}</p>
          <ol className={styles.stepList}>{gate.steps.map(step=><li key={step}>{step}</li>)}</ol>
          <h4>Bằng chứng bắt buộc</h4>
          <ul className={styles.proofList}>{gate.evidence.map(proof=><li key={proof}>{proof}</li>)}</ul>
          <p className={styles.stop}><strong>DỪNG:</strong> {gate.stop}</p>
          <div className={styles.gateActions}>
            <button type="button" onClick={()=>setGateId(gates[Math.max(0,gates.findIndex(x=>x.id===gate.id)-1)].id)} disabled={gate.id==="G0"}>← Cổng trước</button>
            <button type="button" onClick={()=>setGateId(gates[Math.min(gates.length-1,gates.findIndex(x=>x.id===gate.id)+1)].id)} disabled={gate.id==="G8"}>Cổng tiếp →</button>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <h2>3. Lượt xử lý: gộp thế nào để tiết kiệm?</h2>
        <p className={styles.muted}>9 lượt tương ứng 9 cổng, tổng {totalSteps} bước tham chiếu. Các nhóm dưới đây là <strong>khuyến nghị tổ chức công việc</strong>, không phải giới hạn số lượt do Hiến pháp áp đặt.</p>
        <div className={styles.modeNav} aria-label="Chọn nhóm lượt">
          {executionRecommendations.map(item=><button type="button" key={item.id} aria-pressed={phase===item.id}
            onClick={()=>setPhase(item.id)} className={phase===item.id?styles.selected:""}>{item.label}</button>)}
        </div>
        <div className={styles.batch}>
          <p className={styles.eyebrow}>NHÓM ĐỀ XUẤT</p>
          <h3>{recommendation.combine}</h3>
          <p><strong>{recommendation.rounds} lượt, tổng {recommendation.steps} bước tham chiếu.</strong> {phase==="release"?"Ba lượt này cần cổng chấp thuận riêng; không được tự động gộp thành một lần publish.":"Chỉ gộp trong cùng phiên khi mọi điều kiện và bằng chứng của lượt trước đã đạt."}</p>
          <p>{recommendation.rule}</p>
        </div>
        <div className={styles.ruleGrid}>
          {workflowRules.map(rule=><article key={rule.id}><strong>{rule.id} · {rule.title}</strong><p>{rule.detail}</p></article>)}
        </div>
      </section>

      <section className={styles.panel}>
        <h2>4. Bàn giao sang dự án ChatGPT riêng</h2>
        <p>Đề xuất tên dự án: <strong>{guideProjectName}</strong>. Tool vẫn nằm trong Application-Management; dự án ChatGPT riêng chỉ giúp tách hội thoại, không tạo backend quản trị mới.</p>
        <button type="button" className={styles.primary} onClick={()=>void copyPrompt()}>Sao chép prompt bàn giao</button>
        {message?<p role="status" className={styles.message}>{message}</p>:null}
        <p className={styles.muted}>Người đang xem: {displayName}. Không lưu trạng thái gạt nút, thông tin tài khoản hoặc secrets trên máy chủ.</p>
      </section>

      <footer className={styles.footer}>
        <strong>Tham khảo nguồn sự thật</strong>
        <div>{referenceLinks.map(item=><a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer">{item.name}</a>)}</div>
        <p>Không suy ra kết quả từ một PDF hoặc screenshot cũ. Mỗi lần publish phải xác minh lại Worker Version, D1, exact SHA và giao diện thực. Không đi tiếp khi G0–G8 chưa có chứng cứ phù hợp.</p>
      </footer>
    </div>
  </main>;
}

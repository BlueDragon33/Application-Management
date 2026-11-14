# Web-App Engineering Playbook | Blueprint OS
## Handoff prompt & scope — 09/11/2026

### Định danh
- ChatGPT Project khuyến nghị: **Web-App Engineering Playbook | Blueprint OS**
- Tên công cụ tiếng Việt: **Hướng dẫn về lập trình Web-App**
- Tên công cụ tiếng Anh: **Web-App Engineering Playbook**
- Đường dẫn Tool: \`/tools/web-app-guide\` trong **Application-Management**.
- Repository chủ sở hữu Tool: \`BlueDragon33/Application-Management\`, nhánh cô lập \`feat/web-app-engineering-guide-20261109\`.
- Hiến pháp: \`BlueDragon33/Software-Blueprint-Hub/docs/UNIVERSAL-CONSTITUTION.md\` (policyVersion 1.3.0 khi kiểm toán).
- Cẩm nang PDF tiếng Việt đã tạo trong hội thoại ngày 09/11/2026; **không coi PDF như chỉ thị Production mới**.

### Phạm vi bắt buộc
Đây là **công cụ đọc/hướng dẫn** đặt trong danh mục Tool hiện có, không phải phần mềm quản trị mới, không tạo Worker/D1/origin/contract mới. Chỉ thêm một route và một mục trong \`systemTools\`, không thay đổi luồng auth, thanh toán, nội dung hoặc những app khác.

Tài liệu phải giúp người dùng học lập trình web-app theo dòng: yêu cầu → ranh giới dữ liệu → UI đã duyệt → QA → Preview → release có phê duyệt → readback và rollback. Các cổng Cloudflare là G0–G8 với tổng bước được tính tự động từ \`guide-data.ts\`.

### Gộp lượt, không gộp thẩm quyền
- **G0 + G1:** có thể gộp trong một phiên chỉ đọc vì cùng phân tích hiện trạng/phạm vi.
- **G2 + G3:** có thể gộp thay đổi mã nhỏ + test/regression trong một phiên nếu không có FAIL; khi FAIL dừng, phân tích log mới.
- **G4 → G5:** một lượt Preview có quyền riêng; kiểm tra giao diện có thể cùng phiên nếu Preview live PASS, UX acceptance vẫn phải có reviewer.
- **G6 / G7:** tuyệt đối không xem một lần chạy CI là phê duyệt Owner hay cho phép Production.
- **G8:** đọc lại ngay sau G7; chỉ đánh dấu USER ACCEPTED khi thật sự có bằng chứng.
- **R7:** sau **3 phương án sửa khác nhau** không giải quyết được cùng một lỗi thì dừng vá thử, quay lại root-cause; đây là giới hạn **số phương án sửa lỗi**, không phải số lượt hội thoại hoặc số bước bắt buộc.
- Mỗi lượt phải ghi **base SHA / head SHA / phạm vi / check / bằng chứng / BLOCKED / một Next Action**.

### Bàn giao sang ChatGPT Project mới (copy nguyên đoạn bên dưới)
\`\`\`text
ACTIVE NEXT ACTION — WEB-APP ENGINEERING PLAYBOOK | BLUEPRINT OS

Vai trò: Principal Software Architect + QA Lead + Release Safety Auditor.
Đối tượng: công cụ Hướng dẫn về lập trình Web-App trong
BlueDragon33/Application-Management, đường dẫn /tools/web-app-guide.

Đọc HEAD thực, Issue #379 Application-Management, Issue #108 BOIECH_AI,
Hiến pháp Blueprint OS 1.3.0 hiện hành và docs/WEB_APP_ENGINEERING_PLAYBOOK_HANDOFF.md.
Đừng tin checkpoint cũ thay cho HEAD/git diff.

Mục tiêu: hoàn thiện công cụ hướng dẫn Web-App và Cloudflare G0–G8,
có kế hoạch lượt xử lý, bước, bằng chứng PASS/FAIL/BLOCKED và điều kiện DỪNG.
Giao diện gọn, dễ dùng, không tự deploy, không cần API/máy chủ/dịch vụ mới.

Không đụng các app không liên quan; giữ nguyên giao diện Bơi Ếch
trước publish commit 01fcfed; giữ mốc App-Management trước PR #381
f347bd0 để so sánh mã nguồn (không khẳng định đã duyệt trực quan).
Chỉ module Quản trị Bơi Ếch trong Application-Management mới được
thiết kế lại theo giao diện Cán bộ quản lý trước publish.

Tổ chức tối đa 2 lượt đọc/phân tích liền nhau hoặc một lượt sửa mã nhỏ
kèm QA trong một phiên. Không gộp release approval với Production.
Số lượt là khuyến nghị, không giả làm luật Hiến pháp.
Với một lỗi: điều tra → vá đúng scope → regression → đánh giá.
Nếu 3 phương án khác nhau không giải quyết được, dừng vá thử và RCA.

Không merge main, deploy Production, sửa/xóa D1, đổi Worker/URL, tạo dịch
vụ trả phí hoặc mở secrets nếu chưa có quyền thật và người phê duyệt.
Nếu có quyền Cloudflare cần Work, bàn giao đúng một checkpoint ngắn.

Báo cáo: DONE / VERIFIED / BLOCKED / duy nhất một ACTIVE NEXT ACTION;
kèm exact SHA, số test và số tệp đã đổi, không nói đã publish khi chỉ CI PASS.
\`\`\`

### Nhiệm vụ kế tiếp của dự án sự cố Bơi Ếch (độc lập với tool)
1. **G0** đọc Cloudflare Version live, DB UUID/flags và ảnh mốc, chưa sửa.
2. **G1** xác nhận diff chỉ module Bơi Ếch, UI cũ bảo toàn.
3. **G2** khắc phục hợp đồng 409 bằng bridge V2 đọc theo quyền, giữ lỗi dữ liệu không xác minh — không giả 0.
4. **G3** test 200/401/403/409 và các app khác, diễn tập migration local, so UI.
5. **G4–G5** Preview thật, E2E+Owner UX, tách biệt Production.
6. **G6–G8** reviewer, exact SHA, production có authority, readback/rollback.

# BaumanWeb — Offline Ops in Application Manager

## Cơ chế

- Offline: mở duy nhất localhost đã đăng ký trong control/local-ops-apps.json. Nhấn icon sẽ yêu cầu script run-all.mjs khởi động các runtime đã hỗ trợ. Không fallback online.
- Online: chỉ mở publicUrl HTTPS trong application registry (bản publish trước đó); không mở Preview và không publish.
- Pull all: tìm repository trong thư mục BaumanWeb (tối đa 2 cấp); chỉ thực hiện git fetch origin main và git merge --ff-only khi nhánh main sạch và lịch sử fast-forward. Repo dirty/diverged/khác nhánh sẽ bỏ qua, hiển thị lý do; không reset hay force. Cần Internet để pull, nhưng không cần GitHub khi chạy offline.

## Khởi động Windows

1. Đặt các repo dưới <ổ đĩa>:\BaumanWeb và cài Node.js >=22.13.0, Git. Cài sẵn dependencies cho các app cần chạy.
2. Nhấp đúp START_BAUMANWEB.vbs trong thư mục Application-Management. Đây là launcher một lần, khởi động helper và local stack ngầm qua Windows, tự mở trình duyệt khi Center sẵn sàng; không phải gõ lệnh CMD.
3. Ở App Manager chọn Offline/Online rồi ấn icon tương ứng. Nhấn Pull all khi đã có mã mới merge lên GitHub.
4. Sau khi Pull all cập nhật mã, hãy khởi động lại stack để runtime sử dụng commit mới. Không hot reload mã server đang chạy.

Nếu startup lỗi, nhấp CHECK_LOCAL_OPS.bat để kiểm tra; xem log .local-ops-bootstrap.log và .local-ops-runtime.log (không commit).

## Giới hạn bảo mật

Helper chỉ nghe 127.0.0.1:3011; yêu cầu Origin App Manager localhost:3000 + token phiên. API chỉ hỗ trợ status, start và pull-all; không cho nhập shell, URL, đường dẫn hoặc lệnh bất kỳ. Không mở port helper ra LAN, không đưa phiên này lên cloud và không sử dụng để cấp quyền Production.

## Ports và phạm vi

Center 3000; Health 3001; RU_LIFE 3002; Bauman Control 3003; Bơi ếch 3004; Bauman Runtime 3005; GrowUP runtime 3006/control 3007; PriceReport runtime 3008/control 3009; NC03 3010.

Blueprint OS monorepo, CAD CAM 3D và PC Manager chưa có launcher localhost dùng chung đã được chứng minh. PC Manager vẫn sử dụng pcmanager://open trên Windows; các app chưa có runner không được nhận port giả hoặc xem là live. Những repo đó vẫn được Pull nếu chúng nằm trong BaumanWeb.

## Cổng nghiệm thu

Windows cold-start trên BaumanWeb thật; verify D1 local; auth localhost; disconnected use; Pull clean/dirty/diverged; readback SHA; restart và runtime identity; CI regression; Blueprint 1.3.0. Không publish production để nghiệm thu.

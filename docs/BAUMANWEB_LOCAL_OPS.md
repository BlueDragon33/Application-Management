# BaumanWeb — Offline Ops in Application Manager

## Cơ chế

- Offline: mở duy nhất localhost đã đăng ký trong control/local-ops-apps.json. Nhấn icon sẽ yêu cầu script run-all.mjs khởi động các runtime đã hỗ trợ. Không fallback online.
- Online: chỉ mở publicUrl HTTPS trong application registry (bản publish trước đó); không mở Preview và không publish.
- Pull all: tìm repository trong thư mục BaumanWeb (tối đa 2 cấp); chỉ thực hiện fetch + merge --ff-only khi nhánh main sạch và lịch sử fast-forward, origin gốc và URL sau rewrite đều thuộc GitHub BlueDragon33. Từ chối file://, ext::, origin khác chủ sở hữu; không can thiệp cấu hình Git. Repo dirty/diverged/khác nhánh hoặc thay đổi trong khi fetch sẽ bỏ qua, hiển thị lý do. SHA trước/sau được giữ đầy đủ 40 ký tự và xác minh HEAD bằng FETCH_HEAD sau cập nhật; không reset hay force. Cần Internet để pull, nhưng không cần GitHub khi chạy offline.

## Khởi động Windows

1. Đặt các repo dưới <ổ đĩa>:\BaumanWeb và cài Node.js >=22.13.0, Git. Cài sẵn dependencies cho các app cần chạy.
2. Nhấp đúp START_BAUMANWEB.vbs trong thư mục Application-Management. Đây là launcher một lần, khởi động helper và local stack ngầm qua Windows, tự mở trình duyệt khi Center sẵn sàng; không phải gõ lệnh CMD.
3. Ở App Manager chọn Offline/Online rồi ấn icon tương ứng. Nhấn Pull all khi đã có mã mới merge lên GitHub.
4. Sau khi Pull all cập nhật mã, trạng thái `restartRequired` sẽ bật khi stack đang chạy. App Manager không cho mở nhầm runtime cũ như bản mới. Dừng stack cũ đúng quy trình, rồi chạy lại `START_BAUMANWEB.vbs`; kiểm tra endpoint/phiên bản trước khi coi là nghiệm thu. Chưa có restart cưỡng bức tự động vì `taskkill /F /T` có thể làm hỏng giao dịch D1. Không hot reload mã server đang chạy.

Nếu startup lỗi, nhấp CHECK_LOCAL_OPS.bat để kiểm tra; xem log .local-ops-bootstrap.log và .local-ops-runtime.log (không commit).

## Giới hạn bảo mật

Helper chỉ nghe 127.0.0.1:3011; yêu cầu loopback peer, Host chính xác, Origin App Manager localhost:3000 + token phiên. Mô hình token localhost không chống được phần mềm độc hại chạy trên chính máy hoặc ứng dụng giả mạo chiếm cổng 3000; không coi đây là xác thực người dùng. Probe offline không đi theo redirect đến web online. API chỉ hỗ trợ status, start và pull-all; không cho nhập shell, URL, đường dẫn hoặc lệnh bất kỳ. Không mở port helper ra LAN, không đưa phiên này lên cloud và không sử dụng để cấp quyền Production.

## Ports và phạm vi

Center 3000; Health 3001; RU_LIFE 3002; Bauman Control 3003; Bơi ếch 3004; Bauman Runtime 3005; GrowUP runtime 3006/control 3007; PriceReport runtime 3008/control 3009; NC03 3010.

Blueprint OS monorepo, CAD CAM 3D và PC Manager chưa có launcher localhost dùng chung đã được chứng minh. PC Manager vẫn sử dụng pcmanager://open trên Windows; các app chưa có runner không được nhận port giả hoặc xem là live. Những repo đó vẫn được Pull nếu chúng nằm trong BaumanWeb.

## Cổng nghiệm thu

Tự động CI gồm test giao thức localhost, các tình huống Pull all có Git fixture thật, và Docker --network none cho riêng route gốc App Manager; vẫn bắt buộc Windows cold-start trên BaumanWeb thật; verify D1 local; auth localhost; disconnected use; Pull clean/dirty/diverged; readback SHA; restart và runtime identity; CI regression; Blueprint 1.3.0. Không publish production để nghiệm thu.

## Bằng chứng kiểm thử bổ sung — phạm vi chính xác

- `scripts/local-d1-persistence-smoke.mjs`: Wrangler D1 **--local --persist-to** trong thư mục tạm của hệ điều hành; tạo bảng QA riêng, ghi marker, thoát process Wrangler rồi đọc marker ở process mới; tự dọn thư mục tạm. Không chạy `--remote`, không chạm D1 người dùng hay dữ liệu thật. Đây là bằng chứng tính bền của **fixture D1**, chưa xác nhận migration, auth và save/restore của từng app.
- `tests/local-ops-windows-smoke.test.mjs`: chạy trên Windows GitHub Actions, dựng `BaumanWeb/Application-Management` tạm, cold-start helper chỉ nghe loopback, thử phiên xác thực, dừng/mở lại helper và bảo đảm token cũ mất hiệu lực. **Không khởi động full 7-app stack**, không gọi launcher `--start` và không tự động xác nhận máy Windows của chủ sở hữu.
- `tests/local-ops-git-real.test.mjs`: Git bare/repo tạm, fast-forward, dirty/diverged, đối chiếu full SHA; không Pull kho thực.
- `scripts/local-isolated-network-none-smoke.mjs`: xác minh route `/` trung tâm trong `Docker --network none`; không chứng minh toàn bộ ứng dụng hay cơ sở dữ liệu có thể chạy khi mạng mất.
- Runtime đang chạy sau Pull: server trả `restartRequired=true`; App Manager từ chối coi HTTP 200 là bản đã Pull. **Không tự taskkill cưỡng bức** vì rủi ro với giao dịch SQLite/D1; restart full stack và SHA runtime readback trên Windows thật vẫn **BLOCKED**.

Nghiệm thu còn thiếu: thư mục BaumanWeb thật trên Windows, khởi động toàn hệ thống sau khi preload dependency, kiểm tra từng runtime identity/SHA, tính bền dữ liệu D1 sử dụng bởi app thật, đóng mở các process đúng quy trình và kiểm thử khi tháo Internet. Không thể đổi kết quả CI fixture thành `WINDOWS_FULL_STACK_PASS` hoặc `BLUEPRINT_APPROVED`.

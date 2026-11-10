# Owner Bơi Ếch — bản kiểm tra offline R5

## Mở giao diện ngay

Giải nén ZIP và mở `00_MO_GIAO_DIEN_OWNER.html` bằng Chrome hoặc Edge. Không cần Node, Git, cài đặt hay tài khoản. Giao diện dùng chính các component APP của candidate ghi trong `OWNER_REVIEW_SOURCE.json`, kèm dữ liệu mẫu và tài sản đã đóng gói trong file. Không gọi máy chủ; mọi thay đổi chỉ nằm trong dữ liệu mẫu trên trình duyệt.

- **Tổng quan:** số tài khoản, cán bộ chờ duyệt và trạng thái kết nối.
- **Tài khoản & Duyệt cán bộ:** Owner duyệt một lần; sau duyệt vẫn chờ cán bộ tự hoàn thiện hồ sơ, chưa kích hoạt sớm. Hồ sơ cũ cần đối soát không có nút duyệt vòng hai.
- **Thời hạn & Chính sách:** mặc định 30 ngày; chọn cán bộ đã hoạt động để sửa trực tiếp thời hạn hoặc thử tạm khóa/khôi phục. Mặc định chung không tự đổi hạn tài khoản đang dùng.
- **Giám sát GV / học viên:** chỉ đọc. Cán bộ được phân công xử lý các hồ sơ này trong ứng dụng Bơi Ếch.
- **Thiết bị & Tiến độ:** chỉ quan sát; không cấp lại quyền tài khoản qua cửa sổ thiết bị.

Mã MFA **mẫu** là `000000`. Không nhập mã Authenticator thật vào file này. Thanh công cụ cho phép thử lỗi kết nối, CAS 409 và lỗi đọc lại. `Đặt lại mẫu` phục hồi dữ liệu thử; không ảnh hưởng tài khoản thật. Các nút ngoài phạm vi Owner có thể chỉ đọc hoặc báo chưa được mô phỏng; không suy ra backend đã cấp quyền.

## Mở source APP trên Windows

Các CMD là lựa chọn bổ sung, cần Node >=22.13, Git, kết nối tải source/dependencies và repo APP có sẵn tại `E:\BaumanWeb\Application-Management` (hoặc sửa biến `APP_OWNER_WORKSPACE` trong CMD).

1. `01_KIEM_TRA_APP.cmd`: chỉ kiểm tra repo, candidate và cổng.
2. `02_CHUAN_BI_VA_MO_APP.cmd`: fetch đúng SHA trong manifest, tạo worktree riêng ở `_app-owner-review\<sha12>`, cài dependency khóa phiên bản, áp migration **D1 local** và mở `http://127.0.0.1:3006/apps/boi-ech`.
3. `03_MO_LAI_APP.cmd`: mở lại worktree review đã chuẩn bị.
4. `04_CAI_LAI_DEPENDENCY_APP.cmd`: sửa trường hợp thiếu Vite/Wrangler; không xóa D1. Giữ log nếu lệnh thất bại.

Launcher không checkout/pull/reset main hoặc sửa source Bơi Ếch. Cổng 3006 tránh hai cổng cũ APP3000/BOI3004. Worktree review dùng Owner giả cục bộ, không sao chép bí mật hay database của tài khoản thật; `.env*` hoặc `.dev.vars` khác cấu hình gói sẽ làm launcher dừng. Dữ liệu D1 review được sao lưu trước migration; trạng thái repo ban đầu được giữ nguyên.

**Source APP cần bridge Bơi Ếch do phiên Work vận hành riêng để nghiệm thu API thật.** Gói không tự ghép secret, khởi động hoặc đổi BOI. Thiếu bridge phải hiện chưa xác minh, không coi là danh sách rỗng. HTML ở mục đầu luôn là lựa chọn kiểm tra giao diện và mô phỏng riêng biệt.

## Trạng thái kiểm chứng

Đọc `KET_QUA_KIEM_THU.md` trong ZIP. DOM runtime của HTML có kiểm thử; nghiệm thu hình ảnh/responsive trong trình duyệt thật và chạy launcher Windows chưa được xác minh ở môi trường này. HTTPS Preview, MFA/CAS/audit/readback trên backend thật vẫn là cổng riêng. Gói miễn phí; không phát hành Production.

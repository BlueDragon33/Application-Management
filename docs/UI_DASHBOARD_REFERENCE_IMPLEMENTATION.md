# UI Dashboard Reference Implementation

Ảnh dashboard đã duyệt là visual source of truth cho Overview.

## Mục tiêu
- Giữ bố cục, tỷ lệ, hierarchy, spacing gần ảnh tham chiếu.
- Màu tối giản hơn ảnh; giảm glow/gradient/màu sặc sỡ.
- Không đổi backend, API, contract, device semantics, Google OAuth, Authority hoặc TOTP.
- Không hiển thị nút/banner/popup chủ động “Cài Web-App”. PWA/Service Worker vẫn hoạt động nền.

## Dashboard
- Header gọn: search, bộ lọc, kiểm duyệt truy cập, cảnh báo, trạng thái, tài khoản.
- Sidebar: Tổng quan, Hộp việc, Ứng dụng, Thiết bị mới, Thanh toán & Quyền, Cảnh báo, Nhật ký.
- Cài đặt tiếp tục thuộc menu tài khoản và nút Giao diện trong Thao tác nhanh; không tạo tab sidebar riêng.
- 4 KPI cùng hàng.
- Desktop 16:9:
  - trái trên: Ứng dụng đang quản lý;
  - trái dưới: Hộp việc ưu tiên;
  - phải: Cảnh báo nhanh → Thao tác nhanh → Thiết bị mới.
- App overview dùng dữ liệu thật, 4 cột khi đủ rộng, scroll nội bộ khi dài.
- Trạng thái chỉ dùng màu có ý nghĩa; panel nền phẳng, border mảnh, shadow tối thiểu.
- Responsive giữ tablet/mobile usable, không scale desktop nguyên khối.

## Token-saving
- Không scan repo.
- Chỉ HEAD/diff/file Dashboard liên quan.
- Không refactor ngoài phạm vi.
- Test liên quan trước; chỉ mở rộng khi fail.

## Acceptance
- Không còn UI “Cài Web-App”.
- Không overflow desktop/tablet/mobile.
- Không lỗi tiếng Việt.
- Dữ liệu/contract/device/auth hiện tại không bị thay đổi.
- Typecheck + dashboard regressions + Fast CI pass.
- Chưa Production deploy trước khi preview/visual check ổn.

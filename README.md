# Application Management

Application Management là **control-plane quản trị** cho các web app/site độc lập trong hệ thống. Trung tâm không phải nơi chạy nội dung học tập, sức khỏe hay các nghiệp vụ chuyên môn của từng site.

## Kiến trúc bắt buộc

```text
Application Management
├── Thiết bị quản trị Trung tâm (P-256)
├── Vai trò & phân quyền
├── Application Registry
├── Audit & bảo mật
└── Contract quản trị
    ├── Bơi ếch AI          → runtime / DB / registry thiết bị riêng
    ├── Sức khỏe Y tế       → runtime / DB / registry thiết bị riêng
    ├── Hòa nhập Nga        → runtime / DB / registry thiết bị riêng
    ├── Bauman Master AI    → runtime / dữ liệu / môn học riêng
    └── GrowUP MyChildren   → runtime / dữ liệu / thiết bị riêng
```

Mỗi ứng dụng phải hoạt động độc lập. Application Management chỉ được:

- cấp, khóa và thu hồi quyền truy cập;
- cấp hoặc thu hồi quyền chỉnh sửa;
- quản lý thiết bị quản trị Trung tâm;
- theo dõi trạng thái vận hành cần thiết qua API/contract;
- kiểm duyệt các thay đổi mà ứng dụng chủ động gửi lên;
- ghi audit cho các thay đổi quyền và bảo mật.

Application Management **không được** chứa database chuyên môn của ứng dụng, dùng chung registry thiết bị giữa các site, nhúng runtime của site con hoặc dựng thao tác quản trị khi backend thật chưa tồn tại.

## Chuẩn thiết bị của site con

Các site được quản lý theo cùng một contract logic nhưng không dùng chung dữ liệu:

1. site tự sinh/giữ định danh thiết bị;
2. tự động phân loại `desktop`, `phone`, `tablet/iPad`;
3. gửi yêu cầu truy cập;
4. Trung tâm hoặc khu quản trị riêng phê duyệt theo chính sách;
5. quyền truy cập và quyền chỉnh sửa là hai lớp độc lập;
6. site giữ presence/online-offline và audit của chính nó;
7. Trung tâm chỉ đọc/điều khiển qua vé hoặc API quản trị ngắn hạn.

## Control-plane hiện tại

Root `/` là Application Hub với bốn khu vực:

- **Tổng quan** — tình trạng hệ thống, contract và việc cần xử lý;
- **Ứng dụng** — registry và đường vào khu quản trị riêng;
- **Thiết bị & quyền** — chỉ dành cho thiết bị quản trị Application Management;
- **Nhật ký & bảo mật** — audit của control-plane.

Bơi ếch đang có backend quản trị hoạt động và được giữ ở `/apps/boi-ech`. Các ứng dụng khác chỉ bật thao tác thực tế khi repository tương ứng cung cấp admin contract chính thức; trước đó giao diện chỉ mô tả trạng thái, ranh giới và yêu cầu tích hợp để tránh chức năng giả.

## Bảo mật

Thiết bị quản trị dùng khóa P-256 và challenge một lần. Vai trò Trung tâm:

- `viewer`
- `reviewer`
- `publisher`
- `owner`

Các thao tác cấp quyền, khóa thiết bị, thu hồi hoặc xóa tài khoản quản trị được giới hạn theo vai trò và ghi vào `control_audit_log`. Thiết bị/tài khoản owner được bảo vệ khỏi thao tác tự hủy từ giao diện.

## Development

- Node.js `>=22.13.0`
- `npm run install:ci`
- `npm run build`
- `npm test`
- `npm run lint`

Source chính nằm trong `app/`. D1 schema/migrations nằm trong `db/` và `drizzle/`.

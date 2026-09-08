# Hòa nhập Nga — ranh giới tích hợp với Site Quản trị

## Nguyên tắc bắt buộc

**Hòa nhập Nga là một Site/Web App độc lập.** Repo `Learning-Management` chỉ là **Site Quản trị** và không chứa route, giao diện, manifest hay service worker của Web App Hòa nhập Nga.

Địa chỉ Site Hòa nhập Nga được khai báo tại `app/site-links.ts`. Site Quản trị chỉ thực hiện các nhiệm vụ:

- nhận yêu cầu đăng ký thiết bị từ Hòa nhập Nga;
- tự phân loại thiết bị để quản trị viên dễ nhận biết;
- duyệt, thu hồi hoặc khóa quyền truy cập theo từng thiết bị;
- quản lý kiểm duyệt, quy tắc, thống kê và nhật ký thuộc phạm vi quản trị;
- giao tiếp với Site Hòa nhập Nga qua API/secret khi cần.

`control_devices` và `managed_app_devices` là hai miền khác nhau:

- `control_devices`: thiết bị được phép vào **Site Quản trị**;
- `managed_app_devices`: thiết bị người dùng được phép vào **ứng dụng được quản lý**, hiện có `app_id = hoa-nhap-nga`.

Không được dùng quyền của thiết bị quản trị để thay thế quyền của thiết bị Hòa nhập Nga.

## Luồng truy cập Hòa nhập Nga

Cơ chế giữ tinh thần giống Site Bơi ếch: Site người dùng hoạt động riêng nhưng quyền được quyết định từ Trung tâm.

1. Lần đầu mở Hòa nhập Nga, trình duyệt tạo cặp khóa ECDSA P-256 và lưu khóa riêng cục bộ bằng IndexedDB.
2. Site gửi khóa công khai cùng hồ sơ nhận diện thiết bị tới `POST /api/apps/hoa-nhap-nga/device` với `action=register`.
3. Site Quản trị tạo mã thiết bị dạng `HN-XXXX-XXXX-XXXX-XXXX`, trạng thái mặc định `pending`.
4. Thiết bị xuất hiện trong **Y tế → Hòa nhập Nga → Thiết bị truy cập**.
5. Publisher/Owner có thể `Cấp quyền`, `Thu hồi tạm`, `Khóa` hoặc `Đặt tên` thiết bị.
6. Khi đã được duyệt, Hòa nhập Nga gọi `action=challenge`, ký chuỗi
   `managed-app:hoa-nhap-nga:<deviceId>:<challenge>` bằng khóa riêng cục bộ rồi gửi `action=authorize`.
7. Site Quản trị xác minh chữ ký và chỉ khi thiết bị vẫn là `approved` mới phát token HMAC ngắn hạn có audience `hoa-nhap-nga-device`.
8. **Site Hòa nhập Nga độc lập** phải xác minh token này ở phía server và tạo phiên/cookie của chính nó. Không có màn hình đăng nhập trực tiếp trên Hòa nhập Nga.

Nếu thiết bị bị chuyển về `pending` hoặc `blocked`, lần xác thực tiếp theo bị từ chối. Token có thời hạn ngắn để việc thu hồi quyền có hiệu lực nhanh mà không phụ thuộc tài khoản quản trị.

## API phía Site Quản trị

### Public gateway dành riêng cho Hòa nhập Nga

`POST /api/apps/hoa-nhap-nga/device`

- `register`: đăng ký/đồng bộ hồ sơ thiết bị;
- `challenge`: cấp nonce một lần cho thiết bị đã được duyệt;
- `authorize`: xác minh chữ ký thiết bị và phát access token ngắn hạn.

CORS chỉ chấp nhận origin của `MEDICINE_APP_BASE_URL` (hoặc URL Hòa nhập Nga đã khai báo). API này không dùng cookie đăng nhập Site Quản trị.

### API quản trị thiết bị Hòa nhập Nga

`POST /api/apps/hoa-nhap-nga/control`

API này bắt buộc bằng chứng ECDSA của **thiết bị quản trị đã được duyệt** thông qua cơ chế `verifyControlProof` hiện có.

- `bootstrap`: đọc danh sách thiết bị Hòa nhập Nga;
- `approve`: cấp quyền;
- `pending`: thu hồi tạm/bỏ khóa về trạng thái chờ;
- `block`: khóa;
- `label`: đặt tên gợi nhớ.

Publisher/Owner mới có quyền thay đổi trạng thái hoặc tên thiết bị.

## Nhận diện và phân loại thiết bị

Hồ sơ quản trị lưu các trường:

- `device_class`: computer / phone / tablet / unknown;
- `os_name`;
- `browser_name`;
- `model_hint`;
- `screen`;
- thời điểm tạo, duyệt, khóa, last seen và trạng thái hoạt động.

Các trường này giúp con người nhận biết thiết bị; **không phải căn cứ bảo mật**. Trình duyệt không đảm bảo cho biết chính xác model phần cứng hoặc phân biệt tuyệt đối laptop với desktop. Danh tính bảo mật là khóa ECDSA của thiết bị và `device_id` SHA-256 sinh từ khóa công khai.

## Ranh giới PWA/runtime

Site Quản trị dùng manifest/service worker của riêng nó. Repo này không còn:

- `/ru-medcheck`;
- `public/ru-medcheck.webmanifest`;
- bridge đổi tài khoản quản trị thành phiên Hòa nhập Nga;
- cookie phiên Hòa nhập Nga;
- chế độ Worker biến Site Quản trị thành `integration-russia`.

PWA, offline cache và giao diện người dùng Hòa nhập Nga phải nằm ở mã nguồn/deployment độc lập của Hòa nhập Nga.

## Phần Site Hòa nhập Nga cần triển khai

Mã nguồn độc lập của Hòa nhập Nga cần có lớp `device-access` thực hiện đúng contract trên:

- sinh/lưu P-256 keypair;
- gửi profile thiết bị khi `register`;
- hiển thị mã `HN-...` và trạng thái `pending/blocked` khi chưa được phép;
- tự thử lại trạng thái khi người dùng tải lại hoặc bấm kiểm tra;
- ký challenge và đổi access token thành session phía server;
- bảo vệ toàn bộ nội dung nghiệp vụ bằng session thiết bị;
- không chấp nhận token chỉ dựa trên email/role quản trị.

Đây là ranh giới kiến trúc cần được giữ cố định cho các lần nâng cấp tiếp theo.
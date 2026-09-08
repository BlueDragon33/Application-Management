# Hòa nhập Nga — ranh giới tích hợp với Site Quản trị

## Nguyên tắc bắt buộc

**Hòa nhập Nga là một Site/Web App độc lập.** Repo `Learning-Management` chỉ là **Site Quản trị** và không chứa route, giao diện, manifest hay service worker của Web App Hòa nhập Nga.

Địa chỉ Site Hòa nhập Nga được khai báo tại `app/site-links.ts`. Site Quản trị chỉ thực hiện các nhiệm vụ:

- nhận yêu cầu đăng ký thiết bị từ Hòa nhập Nga;
- tự phân loại thiết bị để quản trị viên dễ nhận biết;
- gắn thiết bị với hồ sơ người sử dụng để biết rõ thiết bị thuộc ai;
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
4. Thiết bị xuất hiện trong **Hòa nhập Nga → Thiết bị · người dùng**.
5. Quản trị viên nhập tối thiểu **Họ tên người sử dụng** và **Mã người dùng/mã hồ sơ**. Có thể bổ sung nhóm/đơn vị, mục đích sử dụng và ghi chú quản trị.
6. Chỉ sau khi hồ sơ người sử dụng đã đủ, Publisher/Owner mới được `Cấp quyền`. Trung tâm vẫn cho phép `Thu hồi tạm`, `Khóa`, `Bỏ khóa` hoặc `Đặt tên` thiết bị độc lập với hồ sơ người dùng.
7. Khi đã được duyệt, Hòa nhập Nga gọi `action=challenge`, ký chuỗi `managed-app:hoa-nhap-nga:<deviceId>:<challenge>` bằng khóa riêng cục bộ rồi gửi `action=authorize`.
8. Site Quản trị xác minh chữ ký và chỉ khi thiết bị vẫn là `approved` mới phát token HMAC ngắn hạn có audience `hoa-nhap-nga-device`.
9. **Site Hòa nhập Nga độc lập** phải xác minh token này ở phía server và tạo phiên/cookie của chính nó. Không có màn hình đăng nhập trực tiếp trên Hòa nhập Nga.

Nếu thiết bị bị chuyển về `pending` hoặc `blocked`, lần xác thực tiếp theo bị từ chối. Token có thời hạn ngắn để việc thu hồi quyền có hiệu lực nhanh mà không phụ thuộc tài khoản quản trị.

## Hồ sơ người sử dụng và danh tính bảo mật

Hồ sơ người sử dụng được lưu riêng tại `managed_app_device_profiles`, gồm:

- `person_name`: họ tên người sử dụng;
- `person_code`: mã người dùng / mã hồ sơ;
- `group_name`: nhóm hoặc đơn vị;
- `purpose`: mục đích sử dụng;
- `admin_note`: ghi chú quản trị;
- người và thời điểm cập nhật.

Hồ sơ này dùng để quản lý con người và phân loại thiết bị, **không phải danh tính mật mã**. Xóa hoặc thay đổi họ tên/mã hồ sơ không làm đổi `device_id`. Danh tính bảo mật vẫn là fingerprint SHA-256 của khóa công khai ECDSA P-256.

Chính sách hiện tại của Hòa nhập Nga là `requireIdentifiedUserBeforeApprove = true`: cả cấp quyền đơn lẻ và hàng loạt đều bị chặn nếu thiếu `person_name` hoặc `person_code`.

## API phía Site Quản trị

### Public gateway dành riêng cho Hòa nhập Nga

`POST /api/apps/hoa-nhap-nga/device`

- `register`: đăng ký/đồng bộ hồ sơ kỹ thuật của thiết bị;
- `challenge`: cấp nonce một lần cho thiết bị đã được duyệt;
- `authorize`: xác minh chữ ký thiết bị và phát access token ngắn hạn.

CORS chỉ chấp nhận origin của `MEDICINE_APP_BASE_URL` (hoặc URL Hòa nhập Nga đã khai báo). API này không dùng cookie đăng nhập Site Quản trị.

### API quản trị thiết bị Hòa nhập Nga

`POST /api/apps/hoa-nhap-nga/control`

API này bắt buộc bằng chứng ECDSA của **thiết bị quản trị đã được duyệt** thông qua cơ chế `verifyControlProof` hiện có.

- `bootstrap`: đọc danh sách thiết bị Hòa nhập Nga, hồ sơ người dùng, chính sách và nhật ký;
- `profile`: cập nhật hồ sơ người sử dụng;
- `approve`: cấp quyền, nhưng chỉ khi hồ sơ người sử dụng đã đủ;
- `pending`: thu hồi tạm/bỏ khóa về trạng thái chờ;
- `block`: khóa;
- `label`: đặt tên gợi nhớ;
- `bulk`: cấp quyền/thu hồi/khóa nhiều thiết bị, tối đa 50 thiết bị mỗi lượt. Cấp quyền hàng loạt vẫn bắt buộc mọi thiết bị được chọn có hồ sơ người dùng đầy đủ.

Publisher/Owner mới có quyền thay đổi trạng thái, tên hoặc hồ sơ người sử dụng của thiết bị.

## Nhận diện và phân loại thiết bị

Hồ sơ kỹ thuật lưu các trường:

- `device_class`: computer / phone / tablet / unknown;
- `os_name`;
- `browser_name`;
- `model_hint`;
- `screen`;
- thời điểm tạo, duyệt, khóa, last seen và trạng thái hoạt động.

Các trường này giúp con người nhận biết thiết bị; **không phải căn cứ bảo mật**. Trình duyệt không đảm bảo cho biết chính xác model phần cứng hoặc phân biệt tuyệt đối laptop với desktop. Danh tính bảo mật là khóa ECDSA của thiết bị và `device_id` SHA-256 sinh từ khóa công khai.

## Quản trị vận hành

Khu **Hòa nhập Nga → Thiết bị · người dùng** hiện hỗ trợ:

- tự đồng bộ trạng thái mỗi 60 giây khi tab đang hiển thị;
- giữ lại danh sách gần nhất nếu đồng bộ nền lỗi;
- phát hiện thiết bị mới chờ duyệt;
- tra cứu theo mã HN, tên thiết bị, người dùng, mã hồ sơ, nhóm, OS, browser hoặc model;
- lọc theo trạng thái, online, chưa đặt tên hoặc chưa gắn người dùng;
- sắp xếp theo ưu tiên xử lý, thời điểm đăng ký, hoạt động gần nhất hoặc tên;
- xem drawer chi tiết thiết bị và fingerprint khóa;
- thao tác đơn lẻ hoặc hàng loạt;
- xuất CSV/JSON;
- nhật ký riêng cho thay đổi quyền, tên và hồ sơ thiết bị HN.

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
- gửi profile kỹ thuật thiết bị khi `register`;
- hiển thị mã `HN-...` và trạng thái `pending/blocked` khi chưa được phép;
- tự thử lại trạng thái khi người dùng tải lại hoặc bấm kiểm tra;
- ký challenge và đổi access token thành session phía server;
- bảo vệ toàn bộ nội dung nghiệp vụ bằng session thiết bị;
- không chấp nhận token chỉ dựa trên email/role quản trị.

**Hiện trong các repository GitHub được kết nối chưa có repository mã nguồn riêng cho Site Hòa nhập Nga.** Vì vậy hợp đồng và cổng quản trị đã sẵn sàng ở `Learning-Management`, nhưng phần runtime phía Site độc lập phải được nối trong repository/deployment riêng của Hòa nhập Nga khi mã nguồn đó được đưa vào GitHub hoặc một công cụ triển khai có thể chỉnh sửa trực tiếp.

Đây là ranh giới kiến trúc cần được giữ cố định cho các lần nâng cấp tiếp theo.
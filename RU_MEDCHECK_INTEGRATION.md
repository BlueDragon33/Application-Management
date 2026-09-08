# Hòa nhập Nga — ranh giới tích hợp với Quản trị ứng dụng

## Nguyên tắc bắt buộc

**Hòa nhập Nga là một Site/Web App độc lập.** Repo `BlueDragon33/Application-Management` chỉ là **Quản trị ứng dụng** và không chứa route, giao diện, manifest hay service worker của Web App Hòa nhập Nga. Runtime Hòa nhập Nga nằm tại repo `BlueDragon33/RU_LIFE`.

Địa chỉ Site Hòa nhập Nga được khai báo tại `app/site-links.ts`. Quản trị ứng dụng chỉ thực hiện các nhiệm vụ:

- nhận yêu cầu đăng ký thiết bị từ Hòa nhập Nga;
- tự kiểm tra tín hiệu và phân loại thiết bị để quản trị viên dễ nhận biết;
- gắn thiết bị với hồ sơ người sử dụng để biết rõ thiết bị thuộc ai;
- chạy preflight bắt buộc trước khi cấp quyền;
- duyệt, thu hồi hoặc khóa quyền truy cập theo từng thiết bị;
- ghi nhận access session được Trung tâm phát và lịch sử sự cố kết nối;
- quản lý kiểm duyệt, quy tắc, thống kê và nhật ký thuộc phạm vi quản trị;
- giao tiếp với Site Hòa nhập Nga qua API/secret khi cần.

`control_devices` và `managed_app_devices` là hai miền khác nhau:

- `control_devices`: thiết bị được phép vào **Quản trị ứng dụng**;
- `managed_app_devices`: thiết bị người dùng được phép vào **ứng dụng được quản lý**, hiện có `app_id = hoa-nhap-nga`.

Không được dùng quyền của thiết bị quản trị để thay thế quyền của thiết bị Hòa nhập Nga.

## Luồng truy cập Hòa nhập Nga

Cơ chế giữ tinh thần giống Site Bơi ếch: Site người dùng hoạt động riêng nhưng quyền được quyết định từ Trung tâm.

1. Lần đầu mở Hòa nhập Nga, RU_LIFE tạo cặp khóa ECDSA P-256 và lưu khóa riêng cục bộ bằng IndexedDB.
2. RU_LIFE tự thu thập tín hiệu nhận diện thiết bị rồi gửi khóa công khai cùng profile kỹ thuật tới `POST /api/apps/hoa-nhap-nga/device` với `action=register`.
3. Quản trị ứng dụng **tự phân loại lại ở phía server** thành `computer`, `phone`, `tablet` hoặc `unknown`; không tin tuyệt đối `deviceClass` do browser gửi lên.
4. Quản trị ứng dụng tạo mã thiết bị dạng `HN-XXXX-XXXX-XXXX-XXXX`, trạng thái mặc định `pending`.
5. Thiết bị xuất hiện trong **Hòa nhập Nga → Thiết bị · người dùng** cùng loại thiết bị đã được hệ thống phân loại.
6. Quản trị viên nhập tối thiểu **Họ tên người sử dụng** và **Mã người dùng/mã hồ sơ**. Có thể bổ sung nhóm/đơn vị, mục đích sử dụng và ghi chú quản trị.
7. Trước khi cấp quyền, Trung tâm chạy preflight: RU_LIFE phải healthy, shared secret/origin/protocol phải hợp lệ, hồ sơ người dùng phải đủ, thiết bị phải được phân loại chắc chắn và không ở trạng thái blocked.
8. Chỉ Publisher/Owner mới được `Cấp quyền`. Trung tâm vẫn cho phép `Thu hồi tạm`, `Khóa`, `Bỏ khóa` hoặc `Đặt tên` thiết bị độc lập với hồ sơ người dùng.
9. Khi đã được duyệt, Hòa nhập Nga gọi `action=challenge`, ký chuỗi `managed-app:hoa-nhap-nga:<deviceId>:<challenge>` bằng khóa riêng cục bộ rồi gửi `action=authorize`.
10. Quản trị ứng dụng xác minh chữ ký và chỉ khi thiết bị vẫn là `approved` mới phát token HMAC ngắn hạn có audience `hoa-nhap-nga-device`. Mỗi lần phát token được ghi vào session ledger của Trung tâm.
11. RU_LIFE xác minh token này ở phía server và tạo phiên/cookie của chính nó. Không có màn hình đăng nhập trực tiếp trên Hòa nhập Nga.
12. RU_LIFE heartbeat định kỳ để cập nhật `last_seen`, trạng thái online và phát hiện thu hồi/khóa từ xa.

Nếu thiết bị bị chuyển về `pending` hoặc `blocked`, lần xác thực tiếp theo bị từ chối, session ledger còn hiệu lực của thiết bị cũng được đánh dấu thu hồi và RU_LIFE heartbeat sẽ xóa phiên cục bộ. Token có thời hạn ngắn để việc thu hồi quyền có hiệu lực nhanh mà không phụ thuộc tài khoản quản trị.

## Hồ sơ người sử dụng và danh tính bảo mật

Hồ sơ người sử dụng được lưu riêng tại `managed_app_device_profiles`, gồm:

- `person_name`: họ tên người sử dụng;
- `person_code`: mã người dùng / mã hồ sơ;
- `group_name`: nhóm hoặc đơn vị;
- `purpose`: mục đích sử dụng;
- `admin_note`: ghi chú quản trị;
- người và thời điểm cập nhật.

Hồ sơ này dùng để quản lý con người và phân loại thiết bị, **không phải danh tính mật mã**. Xóa hoặc thay đổi họ tên/mã hồ sơ không làm đổi `device_id`. Danh tính bảo mật vẫn là fingerprint SHA-256 của khóa công khai ECDSA P-256.

Chính sách hiện tại của Hòa nhập Nga:

- `requireIdentifiedUserBeforeApprove = true`;
- `requireResolvedDeviceClassBeforeApprove = true`;
- `requireHealthyIntegrationBeforeApprove = true`;
- `classificationReviewThreshold = 60`.

Cấp quyền đơn lẻ và hàng loạt đều phải tuân thủ cùng các điều kiện này ở phía server; giao diện không thể bỏ qua preflight.

## Preflight trước cấp quyền

Preflight được đánh giá bởi `app/managed-app-preflight.server.ts` và được mở trong giao diện tại:

`/medical-control/access-preflight`

Các check hiện tại:

1. **Kết nối RU_LIFE — bắt buộc**: runtime reachable, `overall=healthy`, HMAC shared secret đúng, origin đúng và protocol `ru-life-control-health-v1`.
2. **Hồ sơ người sử dụng — bắt buộc**: có `person_name` và `person_code`.
3. **Phân loại thiết bị — bắt buộc**: override không phải `unknown`, hoặc phân loại tự động không phải `unknown` và độ tin cậy tối thiểu 60%.
4. **Trạng thái registry — bắt buộc**: thiết bị không được ở trạng thái `blocked` khi duyệt; thiết bị bị khóa phải được đưa về `pending` trước.
5. **Heartbeat gần đây — cảnh báo**: quá 15 phút không liên hệ chỉ cảnh báo quản trị viên, không tự động chặn.

`approve` vẫn tự chạy lại các điều kiện bắt buộc ở server. Nút `Cấp quyền` trên trang preflight chỉ là lớp giao diện hỗ trợ, không phải nơi duy nhất thực thi chính sách.

## Session ledger của Hòa nhập Nga

Quản trị ứng dụng lưu lịch sử access token đã phát tại bảng runtime-idempotent `managed_app_sessions`.

Các trường chính:

- `session_id`;
- `app_id`;
- `device_id`;
- `device_code`;
- `issued_at`;
- `expires_at`;
- `last_seen_at`;
- `revoked_at`;
- `revoke_reason`.

Trạng thái công khai của ledger là `active`, `revoked` hoặc `expired`.

Nguyên tắc:

- mỗi lần `authorize` thành công, Trung tâm ghi một session mới;
- khi cấp token mới cho cùng thiết bị, token ledger cũ còn hiệu lực được đóng với lý do `renewed`;
- khi chuyển thiết bị sang `pending`, các session ledger còn hiệu lực được thu hồi với lý do `access-revoked`;
- khi `block`, các session ledger còn hiệu lực được thu hồi với lý do `device-blocked`;
- thao tác hàng loạt tuân thủ cùng quy tắc.

Session ledger là bằng chứng vận hành về token quyền do Trung tâm phát. Nó không được dùng thay danh tính P-256 của thiết bị.

## Lịch sử sự cố kết nối RU_LIFE

Kết quả health-check được ghi có trạng thái tại `ru_life_integration_incidents`:

- chỉ mở sự cố khi trạng thái là `degraded` hoặc `down`;
- cùng một mã lỗi đang mở sẽ tăng `occurrences` và cập nhật `last_seen_at`;
- khi lỗi thay đổi, sự cố trước được đóng và sự cố mới được mở;
- khi health trở lại `healthy`, sự cố đang mở được đánh dấu `resolved_at`.

Giao diện `/medical-control/integration-health` hiển thị cả session ledger và lịch sử sự cố, giúp phân biệt rõ lỗi runtime, secret, origin, protocol và thời điểm khôi phục.

## API phía Quản trị ứng dụng

### Public gateway dành riêng cho Hòa nhập Nga

`POST /api/apps/hoa-nhap-nga/device`

- `register`: đăng ký/đồng bộ hồ sơ kỹ thuật và tự phân loại thiết bị;
- `challenge`: cấp nonce một lần cho thiết bị đã được duyệt;
- `authorize`: xác minh chữ ký thiết bị, phát access token ngắn hạn và ghi session ledger.

CORS chỉ chấp nhận origin của `MEDICINE_APP_BASE_URL` (hoặc URL Hòa nhập Nga đã khai báo). API này không dùng cookie đăng nhập Quản trị ứng dụng.

### API quản trị thiết bị Hòa nhập Nga

`POST /api/apps/hoa-nhap-nga/control`

API này bắt buộc bằng chứng ECDSA của **thiết bị quản trị đã được duyệt** thông qua cơ chế `verifyControlProof` hiện có.

- `bootstrap`: đọc danh sách thiết bị Hòa nhập Nga, hồ sơ người dùng, chính sách và nhật ký;
- `preflight`: chạy kiểm tra trước cấp quyền và trả báo cáo từng thiết bị;
- `profile`: cập nhật hồ sơ người sử dụng;
- `approve`: cấp quyền, nhưng chỉ khi profile, classification và integration preflight đều đạt;
- `pending`: thu hồi tạm/bỏ khóa về trạng thái chờ và đóng access-session còn hiệu lực;
- `block`: khóa và đóng access-session còn hiệu lực;
- `label`: đặt tên gợi nhớ;
- `classify`: đặt hoặc bỏ override phân loại;
- `bulk`: cấp quyền/thu hồi/khóa nhiều thiết bị, tối đa 50 thiết bị mỗi lượt. Các điều kiện preflight server vẫn áp dụng cho cấp quyền hàng loạt.

Publisher/Owner mới có quyền thay đổi trạng thái, tên hoặc hồ sơ người sử dụng của thiết bị. Reviewer có thể xem preflight/health nhưng không được thay đổi quyền truy cập.

### API health quản trị

`POST /api/apps/hoa-nhap-nga/health`

Trả về:

- trạng thái health hai chiều của RU_LIFE;
- thống kê registry;
- số access session đang active;
- danh sách session gần đây;
- lịch sử sự cố kết nối.

API này vẫn nằm sau signed control-device proof và không trả secret ra client.

## Nhận diện và phân loại thiết bị

RU_LIFE hiện thu thập các tín hiệu sau khi mở Site:

- User-Agent;
- User-Agent Client Hints khi trình duyệt hỗ trợ: `platform`, `mobile`, `model`, `architecture`, `bitness`;
- `navigator.maxTouchPoints`;
- coarse pointer;
- kích thước màn hình và viewport;
- platform/model hint;
- hệ điều hành và trình duyệt suy ra cục bộ.

Gateway của Quản trị ứng dụng nhận các tín hiệu này và **quyết định lại loại thiết bị ở server**. Quy tắc chính:

- iPhone/iPod → `phone`;
- Android Mobile → `phone`;
- Android không Mobile → `tablet`;
- iPad/iPadOS → `tablet`, kể cả trường hợp iPadOS gửi UA dạng Macintosh nhưng có multi-touch;
- Windows/macOS/Linux/ChromeOS desktop → `computer`;
- thiết bị cảm ứng chưa rõ loại → kết hợp touch + coarse pointer + cạnh màn hình ngắn nhất;
- không đủ dữ liệu → `unknown`, không tự đoán bừa.

Hồ sơ kỹ thuật lưu các trường:

- `device_class`: computer / phone / tablet / unknown;
- kết quả tự động, độ tin cậy, nguồn phân loại và classifier version;
- manual override nếu quản trị viên xác nhận lại;
- `os_name`;
- `browser_name`;
- `model_hint`;
- `screen`;
- thời điểm tạo, duyệt, khóa, last seen và trạng thái hoạt động.

Các trường này giúp con người nhận biết và thống kê thiết bị; **không phải căn cứ bảo mật**. Trình duyệt không đảm bảo cho biết chính xác model phần cứng hoặc phân biệt tuyệt đối laptop với desktop/máy tính bảng lai. Danh tính bảo mật là khóa ECDSA của thiết bị và `device_id` SHA-256 sinh từ khóa công khai.

## Quản trị vận hành

Khu **Hòa nhập Nga → Thiết bị · người dùng** hiện hỗ trợ:

- tự đồng bộ trạng thái mỗi 60 giây khi tab đang hiển thị;
- giữ lại danh sách gần nhất nếu đồng bộ nền lỗi;
- phát hiện thiết bị mới chờ duyệt;
- tự gắn loại `Máy tính`, `Điện thoại`, `Máy tính bảng` hoặc `Thiết bị khác` theo `device_class`;
- tra cứu theo mã HN, tên thiết bị, người dùng, mã hồ sơ, nhóm, OS, browser, model hoặc loại thiết bị;
- lọc theo trạng thái, online, chưa đặt tên hoặc chưa gắn người dùng;
- sắp xếp theo ưu tiên xử lý, thời điểm đăng ký, hoạt động gần nhất hoặc tên;
- xem drawer chi tiết thiết bị và fingerprint khóa;
- thao tác đơn lẻ hoặc hàng loạt;
- xuất CSV/JSON có loại thiết bị;
- nhật ký riêng cho thay đổi quyền, tên và hồ sơ thiết bị HN.

Các màn hình chuyên trách:

- `/medical-control/access-preflight`: hàng đợi kiểm tra trước cấp quyền;
- `/medical-control/device-classification`: phân loại, độ tin cậy và manual override;
- `/medical-control/integration-health`: health hai chiều, registry, session ledger và incident history.

## Ranh giới PWA/runtime

Quản trị ứng dụng dùng manifest/service worker của riêng nó. Repo này không chứa runtime Hòa nhập Nga.

PWA, offline cache, giao diện người dùng và session của Hòa nhập Nga nằm tại `BlueDragon33/RU_LIFE`.

## Runtime RU_LIFE hiện đã có

Repo `BlueDragon33/RU_LIFE`, nhánh `work/control-integration`, đã triển khai:

- sinh/lưu P-256 keypair không export private key;
- tự nhận diện loại thiết bị bằng nhiều tín hiệu;
- gửi profile kỹ thuật khi `register`;
- hiển thị mã `HN-...`, loại tự nhận diện và trạng thái `pending/blocked`;
- tự thử lại trạng thái mỗi 60 giây khi tab hiển thị;
- ký challenge và đổi access token thành session phía server;
- bảo vệ `/app` bằng cookie HttpOnly;
- heartbeat 60 giây và làm mới quyền định kỳ;
- phát hiện thu hồi/khóa từ xa và xóa session cục bộ;
- endpoint health challenge-response dùng shared secret;
- không chấp nhận token chỉ dựa trên email/role quản trị;
- service worker không cache `/api/*` và `/app*`.

Đây là ranh giới kiến trúc cần được giữ cố định cho các lần nâng cấp tiếp theo.

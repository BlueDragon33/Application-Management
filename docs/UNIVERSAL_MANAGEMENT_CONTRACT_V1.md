# Universal Management Contract v1

## Mục tiêu

Một ứng dụng mới có thể tham gia **Quản trị Ứng dụng** mà không sửa source trung tâm.

Dynamic Catalog là đường onboarding chuẩn. Trung tâm ưu tiên contract động và chỉ dùng adapter legacy làm fallback tương thích trong giai đoạn migration.

Quy trình:

1. Client triển khai manifest công khai tại `/api/application-management/contract`.
2. Chủ hệ thống mở **Catalog & Contract** trong Application Management.
3. Nhập ID, phân loại, origin và tùy chọn credential.
4. Trung tâm tự probe manifest.
5. Capability nào được client công bố và đủ guardrail thì capability đó xuất hiện trong quản trị.
6. Nếu contract/credential chưa đủ, trạng thái giữ **fail-closed**; tuyệt đối không giả `connected`.

Schema identifier:

```text
application-management.contract/v1
```

## Manifest

```json
{
  "schema": "application-management.contract/v1",
  "application": {
    "id": "my-app",
    "name": "My App",
    "category": "Kỹ thuật",
    "version": "1.0.0"
  },
  "capabilities": {
    "deviceRegistry": true,
    "deviceApproval": true,
    "deviceBlock": true,
    "deviceUnblock": false,
    "deviceEditPermission": false,
    "deviceIdempotentCommands": true,
    "optimisticConcurrency": true,
    "sessions": false,
    "audit": true,
    "contentReview": false,
    "payments": false,
    "reports": false,
    "webLaunch": true
  },
  "endpoints": {
    "status": "/api/control/status",
    "devices": "/api/control/devices",
    "deviceCommands": "/api/control/device-commands",
    "web": "/api/control/web"
  }
}
```

### Quy tắc manifest

- Manifest nên đọc được **không cần credential**, để Trung tâm có thể phát hiện contract.
- `application.id` phải trùng ID trong Catalog.
- Mọi endpoint phải là path dưới `/api/`, không nhận URL ngoài origin đã đăng ký.
- Client không được tự cấp quyền cho Trung tâm. Capability chỉ mô tả khả năng; credential riêng mới cho phép đọc/mutate protected endpoint.
- Capability không công bố hoặc `false` được hiểu là **không hỗ trợ**.

## Device endpoint

Khi `deviceRegistry=true`, endpoint `endpoints.devices` trả:

```json
{
  "devices": [
    {
      "deviceId": "device-immutable-id",
      "deviceCode": "APP-ABCD-1234",
      "deviceType": "desktop",
      "userLabel": "Nguyễn Văn A",
      "status": "pending",
      "active": true,
      "createdAt": "2026-09-25T03:00:00.000Z",
      "lastSeenAt": "2026-09-25T03:20:00.000Z",
      "environmentChanged": false,
      "editEnabled": false,
      "registryInstanceId": "optional-registry-instance"
    }
  ]
}
```

### Device values

`deviceType`:
- `desktop`
- `phone`
- `tablet`
- `unknown`

`status`:
- `pending`
- `approved`
- `blocked`

Client sở hữu registry. Trung tâm chỉ đọc metadata cần cho quản trị, không sao chép dữ liệu nghiệp vụ.

## Device command endpoint

Mutation chỉ được bật khi:

```json
{
  "deviceIdempotentCommands": true,
  "optimisticConcurrency": true
}
```

Request:

```json
{
  "commandId": "uuid-v4",
  "operation": "approve",
  "deviceId": "device-immutable-id",
  "expectedStatus": "pending"
}
```

`operation` hiện hỗ trợ:
- `approve`
- `block`

Client phải:
- từ chối command nếu `expectedStatus` không khớp state live;
- deduplicate theo `commandId`;
- trả cùng kết quả cho replay hợp lệ;
- ghi audit phía client;
- cập nhật registry của chính client.

Trung tâm sẽ đọc lại `devices` sau command. Nếu state không đổi đúng như yêu cầu, thao tác bị coi là thất bại.

## Credential

Credential quản trị do client cấp và được nhập qua **Catalog & Contract**.

Application Management:
- không lưu credential plaintext;
- mã hóa AES-GCM bằng `MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY`;
- D1 chỉ giữ ciphertext + IV;
- không đưa credential vào URL;
- không đưa credential xuống dashboard/browser;
- chỉ server-side bridge dùng credential.

Nếu chưa có root encryption key hoặc chưa nhập credential:
- manifest vẫn probe được;
- app vẫn có thể xuất hiện ở trạng thái chờ/cảnh báo;
- remote mutation bị khóa fail-closed.

## Phân loại

Các category chuẩn:

- Học tập
- Y tế
- Nga
- Học thuật
- Gia đình
- Kế toán
- Kỹ thuật

Category cung cấp **default capability/guardrail/UI semantics**, không tạo quyền ngầm.

Ví dụ:
- Y tế: không đưa hồ sơ sức khỏe cá nhân về control-plane.
- Gia đình: không đưa dữ liệu trẻ em/gia đình riêng tư.
- Kế toán: không đưa dữ liệu khách hàng/báo giá vào control-plane.
- Kỹ thuật: không proxy lệnh nguy hiểm khi contract chưa xác minh.

## Trạng thái trong Trung tâm

### Connected
Manifest hợp lệ + credential hợp lệ + protected endpoint/capability cần thiết hoạt động.

### Warning / migrating
Manifest đã có nhưng credential hoặc capability quản trị chưa đầy đủ.

### Pending
Chưa đọc được manifest chuẩn.

### Unavailable
App từng có contract quản trị live nhưng endpoint hiện không khả dụng.

## Không được làm

- Không dùng registry thiết bị của app khác.
- Không suy quyền app A từ quyền app B.
- Không giả `connected` từ repository metadata.
- Không tự bật mutation chỉ vì endpoint tồn tại.
- Không đưa secret vào manifest.
- Không lưu dữ liệu nghiệp vụ nhạy cảm trong Application Management.
- Không dùng shared bearer token chung cho tất cả app.

## Ví dụ onboarding app mới

Client mới `robot-lab`:

1. Client publish:
   `https://robot-lab.example.com/api/application-management/contract`
2. Trong Catalog:
   - ID: `robot-lab`
   - Category: `Kỹ thuật`
   - Origin: `https://robot-lab.example.com`
   - Public URL: `https://robot-lab.example.com/`
   - Credential: token riêng của `robot-lab`
3. Bấm **Lưu & kiểm tra contract**.
4. Nếu contract hợp lệ, app tự xuất hiện trong dashboard.
5. Không sửa `application-registry.ts`, `operations/route.ts`, workflow hoặc dashboard.

## Contract discovery tương thích

Catalog không bắt buộc mọi client phải đổi schema trong cùng một lần. Probe server-side thử các protocol theo thứ tự:

1. contract path khai báo trong Catalog;
2. `/api/control/contract`;
3. `/management-contract.json`;
4. `/control/application-management.contract.json`;
5. `/api/control/status` bằng credential app-scoped nếu có.

Contract cũ chỉ được normalize khi `application.id` khớp catalog, category không xung đột và endpoint/capability hợp lệ. Trung tâm không suy quyền theo tên app.

## Dynamic-first / legacy-fallback

Bơi ếch, Health, RU LIFE, Bauman, PriceReport và GrowUP vẫn có adapter chuyên biệt để bảo toàn workflow hiện hữu.

Quá trình migrate:
1. thêm chính ID legacy vào Dynamic Catalog;
2. probe protocol live;
3. nếu Dynamic Contract `connected`, Trung tâm dùng generic path trước;
4. nếu Dynamic Contract chưa đủ, adapter legacy tiếp tục làm fallback;
5. sau khi parity đầy đủ mới bỏ adapter cũ.

Không cần flag-day cutover và không cần sửa dashboard/route mỗi lần migrate một app.

## Category contract starter

Catalog có thể sinh contract starter từ category. Starter luôn đặt capability ở `false` mặc định; danh sách capability theo category chỉ là gợi ý onboarding, không tạo quyền ngầm.

## Credential encryption key

Credential app-scoped được mã hóa AES-GCM. Cloudflare deploy workflow bảo đảm `MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY` tồn tại:

- nếu Environment đã cung cấp key thì dùng key đó;
- nếu Worker đã có key thì giữ nguyên;
- nếu chưa có thì sinh ngẫu nhiên 32 byte đúng một lần và lưu trực tiếp dưới dạng Worker Secret.

Giá trị key không được ghi log hoặc lưu D1.

## Legacy adapters

Adapter cũ chỉ còn là compatibility layer trong thời gian migration. Dynamic Catalog là đường chuẩn cho app mới và app cũ sau khi contract generic đạt parity.


## Đồng bộ ứng dụng hiện có

Trang `Catalog & Contract` có hai thao tác vận hành:

### Đồng bộ ứng dụng hiện có

- đọc danh sách app legacy đang thuộc diện quản trị;
- nếu app chưa có Dynamic Catalog entry, hệ thống thử lấy Control Origin/credential legacy server-side;
- nếu không có legacy origin nhưng app có public HTTPS origin, dùng public origin để discovery manifest tĩnh;
- credential legacy, nếu có, chỉ được chuyển server-side và mã hóa AES-GCM trong D1;
- entry động đã tồn tại là nguồn chính và **không bị ghi đè** bởi sync legacy;
- app chưa có origin được trả về trạng thái **Cần Control Origin**, không bị gắn nhãn contract lỗi.

### Kiểm tra lại tất cả contract

- probe lại toàn bộ entry enabled;
- thử Universal Contract và các protocol tương thích;
- không cần deploy lại Application Management;
- app có thể tự chuyển `pending → warning → connected` sau khi client publish endpoint/capability;
- mutation vẫn fail-closed nếu credential/capability/guardrail chưa đủ.

## Quy trình chuẩn từ nay

Thêm app mới không cần sửa code Trung tâm:

1. Mở `Catalog & Contract`.
2. Nhập ID, tên, phân loại, Control Origin, Website và repository.
3. Nếu client chưa có contract, sinh `Contract mẫu theo phân loại`.
4. Client publish manifest/endpoint.
5. Nhập credential app-scoped nếu endpoint protected.
6. Bấm `Lưu & kiểm tra contract`.
7. Sau này khi client nâng capability, chỉ cần `Kiểm tra lại tất cả contract`.

Không thêm env name mới, route riêng, allow-list dashboard hay adapter mới cho app mới.
Adapter legacy chỉ tồn tại cho các app cũ trong giai đoạn migration.


## Zero-code onboarding by URL

Từ lớp Catalog mới, Owner không cần khai báo source code Trung tâm cho từng app.

Quy trình chuẩn:

1. Client publish một trong các endpoint/manifest:
   - `/api/application-management/contract`
   - `/api/control/contract`
   - `/management-contract.json`
   - `/control/application-management.contract.json`
   - hoặc legacy `/api/control/status`.
2. Trong `Catalog & Contract`, dán URL app/control/manifest vào `Khám phá app từ URL`.
3. Trung tâm tự đọc:
   - application id;
   - tên;
   - category nếu client công bố;
   - protocol/version;
   - capability;
   - contract path thực tế.
4. Nếu manifest chưa có category, Owner chọn đúng một trong các category chuẩn. Trung tâm không đoán category từ tên app.
5. Nếu manifest protected, nhập credential app-scoped để probe. Credential chỉ được lưu khi Owner bấm `Lưu`, sau đó mã hóa AES-GCM trong D1.
6. Sau khi lưu, dashboard tự merge entry từ Dynamic Catalog. Không thêm route riêng, allow-list riêng, env name riêng hoặc branch theo app id.
7. `contractConnected` và `remoteAdminReady` là hai trạng thái khác nhau:
   - Contract Connected: manifest đã bắt tay/validate thành công.
   - Remote Admin Ready: đã có credential + endpoint/capability/guardrail đủ cho mutation.
8. Contract đã kết nối nhưng mutation chưa sẵn sàng phải hiển thị read-only/warning, không được báo giả là mất kết nối.

### Yêu cầu tối thiểu của app mới

Manifest tối thiểu nên công bố:

```json
{
  "schema": "application-management.contract/v1",
  "protocol": "application-management.contract/v1",
  "application": {
    "id": "my-app",
    "name": "My App",
    "category": "Kỹ thuật",
    "version": "1"
  },
  "capabilities": {
    "deviceRegistry": false,
    "deviceApproval": false,
    "deviceBlock": false,
    "deviceIdempotentCommands": false,
    "optimisticConcurrency": false,
    "audit": false,
    "webLaunch": true
  },
  "endpoints": {}
}
```

Mọi capability mặc định phải là `false`. Chỉ chuyển sang `true` khi endpoint/backend tương ứng đã hoạt động thật.

### Không cần sửa Application Management khi thêm app mới

Nếu app mới tuân thủ contract trên, các bước cần làm chỉ là:

- deploy app;
- mở `Catalog & Contract`;
- dán URL;
- xác nhận category/credential nếu cần;
- lưu.

Application Management không cần commit source mới để biết tên app đó.


## Runtime state model

Trạng thái kết nối được tách thành hai lớp độc lập:

1. **Contract handshake**: Trung tâm đọc và validate được manifest/protocol của client.
2. **Remote admin readiness**: credential + protected endpoint + capability cần thiết đang hoạt động.

Không được đồng nhất hai lớp này.

### Pending

Chỉ dùng khi ứng dụng **chưa từng handshake contract thành công** tại Production hiện tại.

Ví dụ:
- chưa publish manifest;
- chưa khai báo Control Origin;
- URL contract chưa tồn tại.

### Warning

Contract handshake vẫn thành công nhưng remote admin chưa đầy đủ hoặc tạm lỗi.

Ví dụ:
- chưa có credential;
- client chưa bật device-control capability;
- endpoint thiết bị đang lỗi nhưng manifest vẫn đọc được.

Trong trạng thái này, Website/read-only capability vẫn có thể hoạt động nếu contract cho phép. Không được báo “đang chờ contract”.

### Unavailable

Chỉ dùng khi Dynamic Catalog đã ghi nhận ứng dụng **từng handshake thành công**, nhưng lần probe hiện tại không còn đọc được contract endpoint.

Catalog lưu:
- `last_contract_connected_at`;
- `last_probe_at`;
- `last_probe_error`.

Nhờ đó Trung tâm phân biệt lỗi runtime thật với app chưa từng được Production hóa.

## Generic web launch

App mới không cần route riêng trong Application Management để mở Website.

Contract có thể công bố:

```json
{
  "capabilities": {
    "webLaunch": true
  },
  "endpoints": {
    "web": "/api/control/web"
  }
}
```

Nếu `endpoints.web` có mặt, Trung tâm gọi server-side và chấp nhận payload:

```json
{
  "launchUrl": "https://registered-app-origin.example/path"
}
```

URL trả về phải thuộc Control Origin hoặc Public URL origin đã đăng ký trong Dynamic Catalog. Redirect sang origin lạ bị từ chối.

Nếu `webLaunch=true` nhưng không có `endpoints.web`, Trung tâm mở trực tiếp Public URL/Control Origin đã đăng ký.

Universal Contract luôn được thử trước adapter legacy.

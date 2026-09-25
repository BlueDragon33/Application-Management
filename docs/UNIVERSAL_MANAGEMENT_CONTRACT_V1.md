# Universal Management Contract v1

## Mục tiêu

Một ứng dụng mới có thể tham gia **Quản trị Ứng dụng** mà không sửa source trung tâm.

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

## Legacy adapters

Bơi ếch, Health, RU LIFE, Bauman, PriceReport và GrowUP hiện có adapter chuyên biệt để bảo toàn contract hiện hữu.

Quá trình migrate:
1. client bổ sung Universal Contract v1;
2. kiểm thử generic path;
3. đưa client vào Dynamic Catalog;
4. sau khi parity đầy đủ mới bỏ adapter cũ.

Không đại phẫu đồng loạt.

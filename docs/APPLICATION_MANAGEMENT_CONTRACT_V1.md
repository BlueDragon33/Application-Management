# Application Management Contract Registry v1

## Mục tiêu

`Application Management Contract Registry v1` cho phép thêm một client mới vào diện quản trị **mà không sửa code Trung tâm**.

Trung tâm chỉ cần:
1. Control origin HTTPS của client.
2. Manifest chuẩn tại `/.well-known/application-management.json` hoặc path tùy chọn.
3. Pairing code một lần nếu client yêu cầu authenticated control.

Sau khi discovery/pairing, metadata, origin, capability, endpoint và token đã mã hóa được lưu trong D1.

## Manifest tối thiểu

```json
{
  "protocol": "application-management.contract.v1",
  "application": {
    "id": "my-new-app",
    "name": "My New App",
    "shortName": "New App",
    "initials": "NA",
    "classification": "engineering",
    "categoryLabel": "Kỹ thuật",
    "repository": "BlueDragon33/My_New_App",
    "runtimeOrigin": "https://my-new-app.example.com"
  },
  "auth": {
    "mode": "paired-bearer",
    "pairEndpoint": "/api/control/pair"
  },
  "endpoints": {
    "status": "/api/control/status",
    "devices": "/api/control/devices",
    "deviceCommands": "/api/control/device-commands",
    "automation": "/api/control/automation"
  },
  "capabilities": {
    "deviceRegistry": true,
    "deviceApproval": true,
    "deviceBlocking": true,
    "deviceIdempotentCommands": true,
    "optimisticConcurrency": true,
    "deviceAutoApproval": true,
    "deviceAutoBlockPending": true
  }
}
```

## Phân loại

Các classification chuẩn:

- `learning` → Học tập
- `health` → Y tế
- `academic` → Học thuật
- `family` → Gia đình
- `accounting` → Kế toán
- `engineering` → Kỹ thuật
- `infrastructure` → Hạ tầng
- `operations` → Vận hành
- `other` → Khác

`categoryLabel` là nhãn hiển thị và có thể chi tiết hơn classification.

## Auth

### none

Chỉ dùng cho contract đọc công khai, không có thao tác nhạy cảm.

### paired-bearer

Client tự sinh pairing code dùng một lần. Trung tâm POST:

```json
{
  "protocol": "application-management.contract.v1",
  "applicationId": "my-new-app",
  "pairingCode": "ONE-TIME-CODE",
  "consumer": "application-management"
}
```

Client trả:

```json
{
  "accessToken": "opaque-long-lived-or-rotatable-token",
  "expiresAt": 1790000000
}
```

Trung tâm **không lưu plaintext**. Token được mã hóa AES-GCM trong D1. Vault key được derive bằng domain separation từ `APPLICATION_CONTRACT_VAULT_KEY` nếu có; nếu không thì dùng secret hạ tầng Production/Preview hiện hữu làm root material.

## Device schema

`GET endpoints.devices`:

```json
{
  "devices": [
    {
      "deviceId": "client-owned-stable-id",
      "deviceCode": "APP-ABC123",
      "deviceType": "desktop",
      "displayName": "Máy văn phòng",
      "status": "pending",
      "active": true,
      "createdAt": "2026-09-25T00:00:00Z",
      "lastSeenAt": "2026-09-25T00:00:00Z"
    }
  ]
}
```

Trạng thái chuẩn: `pending | approved | blocked`.

## Device command schema

Trung tâm chỉ bật Duyệt/Khóa khi manifest có:

- `deviceRegistry=true`
- `deviceIdempotentCommands=true`
- `optimisticConcurrency=true`
- capability thao tác tương ứng.

POST `endpoints.deviceCommands`:

```json
{
  "commandId": "uuid",
  "deviceId": "client-owned-stable-id",
  "operation": "approve",
  "expectedStatus": "pending"
}
```

Client phải trả lại cùng `commandId` và Trung tâm sẽ đọc lại registry sau command. Không có read-back thì thao tác được coi là lỗi.

Với thao tác loại bỏ:
- mặc định dùng `block` khi `deviceBlocking=true`;
- chỉ dùng xóa vật lý nếu client công bố `deviceRemoval: "delete"`.

## Automation schema

Nếu client công bố `deviceAutoApproval=true` hoặc `deviceAutoBlockPending=true` và endpoint automation:

GET:

```json
{
  "automation": {
    "autoApproveDevices": false,
    "autoBlockPendingDevices": true,
    "pendingBlockAfterHours": 168
  }
}
```NaN`controlOrigin/runtimeOrigin` của chúng trong D1 mà không redeploy Trung tâm.

Resolver luôn ưu tiên:
1. Contract Registry D1;
2. env legacy;
3. local/hybrid fallback theo cấu hình hiện hữu.

Khi client cũ chuyển sang manifest v1 + pairing, adapter riêng có thể được gỡ ở một PR độc lập sau khi live E2E pass.

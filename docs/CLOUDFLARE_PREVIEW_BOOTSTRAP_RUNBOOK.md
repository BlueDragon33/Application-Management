# Cloudflare Preview · Runbook bootstrap toàn hệ thống

## Phạm vi

`Application-Management` là control-plane trung tâm duy nhất. Health_Care, RU_LIFE, Bơi ếch và Bauman tiếp tục sở hữu runtime/database/registry/audit riêng. Không bước nào trong runbook này tự động promote production.

Application Management preview dùng **application-level preview secret**, không cần Cloudflare Zero Trust.

## 1. GitHub Environments

| Repo | Environment | Preview runtime |
| --- | --- | --- |
| `BlueDragon33/Application-Management` | `application-management-preview` | `application-management-preview` |
| `BlueDragon33/Health_Care` | `health-preview` | `health-care-preview` |
| `BlueDragon33/RU_LIFE` | `ru-life-preview` | `ru-life-preview` |
| `BlueDragon33/BOIECH_AI` | `boi-ech-preview` | `boi-ech-preview` |
| `BlueDragon33/Bauman-master-ai-system` | `bauman-preview` | `bauman-control-preview` + `bauman-master-ai-preview` |

Mọi workflow deploy preview đều là `workflow_dispatch` và yêu cầu nhập chính xác `DEPLOY_PREVIEW`.

## 2. D1 preview tách production/local

Preview D1:

- Application Management: `application-management-preview-db`;
- Health: `health-care-preview-db`;
- RU_LIFE: `ru-life-preview-db`;
- Bơi ếch: `boi-ech-preview-db`;
- Bauman Control: `bauman-control-preview-db`.

Bơi ếch còn cần R2 riêng `boi-ech-preview-payments`.

Production D1 guard bắt buộc:

- `APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID`;
- `HEALTH_PRODUCTION_D1_DATABASE_ID`;
- `RU_LIFE_PRODUCTION_D1_DATABASE_ID`;
- `BOI_ECH_PRODUCTION_D1_DATABASE_ID`;
- `BAUMAN_CONTROL_PRODUCTION_D1_DATABASE_ID`.

Preview và production UUID tuyệt đối không được trùng nhau.

## 3. Pha A · Application Management preview

Environment `application-management-preview` cần:

### Secrets

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID
APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID
APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET
```

`APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET`:

- tối thiểu 32 ký tự;
- không commit vào Git;
- không đặt trong Environment variables;
- không đặt trong URL;
- workflow cài lên Worker bằng `wrangler secret put`.

Không cần tạo hoặc nhập các giá trị Zero Trust sau:

```text
CF_ACCESS_CLIENT_ID
CF_ACCESS_CLIENT_SECRET
CF_ACCESS_TEAM_DOMAIN
CF_ACCESS_AUD
```

### Variables

```text
CONTROL_OWNER_EMAILS
APPLICATION_MANAGEMENT_PREVIEW_ORIGIN
```

Lần deploy đầu để trống:

```text
BOI_ECH_PREVIEW_ORIGIN
HEALTH_CARE_PREVIEW_ORIGIN
RU_LIFE_PREVIEW_ORIGIN
BAUMAN_CONTROL_PREVIEW_ORIGIN
BAUMAN_RUNTIME_PREVIEW_ORIGIN
GROWUP_PREVIEW_ORIGIN
```

Chạy `Application Management Cloudflare Preview Deploy` với `DEPLOY_PREVIEW`.

### Gate pha A

1. anonymous `GET /__deployment` phải trả HTTP 401;
2. request có `Authorization: Bearer <APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET>` phải đọc được `/__deployment`;
3. `application=application-management`;
4. `runtime=control-plane`;
5. `channel=cloudflare-preview`;
6. `databaseReady=true`;
7. `previewAccessConfigured=true`;
8. `accessMode=application-preview-secret`;
9. `ownerPolicyConfigured=true`;
10. `networkMode=production`.

Sau deploy, chạy `Application Management Preview Stack Verify` với mode `phase-a`.

### Truy cập bằng trình duyệt

Mở preview origin. Worker sẽ chuyển người chưa xác thực tới `/__preview-login`. Nhập cùng preview access secret đã lưu trong GitHub. Worker đổi secret thành signed session cookie `HttpOnly + Secure + SameSite=Strict`; secret không đi trong query string.

## 4. Secret liên ứng dụng

Mỗi client dùng secret riêng và giá trị ở client preview phải khớp Application Management preview:

- Bơi ếch: `CONTROL_SERVICE_SECRET`;
- Health: `HEALTH_CONTROL_SERVICE_SECRET`;
- RU_LIFE: `RU_LIFE_CONTROL_SERVICE_SECRET`;
- Bauman: `BAUMAN_CONTROL_SERVICE_SECRET`.

Không dùng một secret chung cho mọi app.

## 5. Pha B · client previews

### Health_Care / `health-preview`

Secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
HEALTH_PREVIEW_D1_DATABASE_ID
HEALTH_PRODUCTION_D1_DATABASE_ID
HEALTH_CONTROL_SERVICE_SECRET
```

Variables:

```text
APPLICATION_MANAGEMENT_PREVIEW_ORIGIN
HEALTH_PREVIEW_ORIGIN
```

### RU_LIFE / `ru-life-preview`

Secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
RU_LIFE_PREVIEW_D1_DATABASE_ID
RU_LIFE_PRODUCTION_D1_DATABASE_ID
RU_LIFE_CONTROL_SERVICE_SECRET
```

Variables:

```text
APPLICATION_MANAGEMENT_PREVIEW_ORIGIN
RU_LIFE_PREVIEW_ORIGIN
```

### Bơi ếch / `boi-ech-preview`

Secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
BOI_ECH_PREVIEW_D1_DATABASE_ID
BOI_ECH_PRODUCTION_D1_DATABASE_ID
CONTROL_SERVICE_SECRET
```

Variables:

```text
APPLICATION_MANAGEMENT_PREVIEW_ORIGIN
BOI_ECH_PREVIEW_ORIGIN
```

R2 preview: `boi-ech-preview-payments`.

### Bauman / `bauman-preview`

Secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
BAUMAN_CONTROL_PREVIEW_D1_DATABASE_ID
BAUMAN_CONTROL_PRODUCTION_D1_DATABASE_ID
BAUMAN_CONTROL_SERVICE_SECRET
```

Variables:

```text
APPLICATION_MANAGEMENT_PREVIEW_ORIGIN
BAUMAN_CONTROL_PREVIEW_ORIGIN
BAUMAN_RUNTIME_PREVIEW_ORIGIN
```

Bauman Control và Learning Runtime phải là hai HTTPS origin khác nhau.

## 6. Pha C · đóng vòng Application Management

Sau khi các client có preview origin thật, cập nhật `application-management-preview`:

```text
HEALTH_CARE_PREVIEW_ORIGIN
RU_LIFE_PREVIEW_ORIGIN
BOI_ECH_PREVIEW_ORIGIN
BAUMAN_CONTROL_PREVIEW_ORIGIN
BAUMAN_RUNTIME_PREVIEW_ORIGIN
```

Đồng thời thêm các app-scoped bridge secrets tương ứng. Giữ `GROWUP_PREVIEW_ORIGIN` trống cho tới khi GrowUP có preview contract thật.

Redeploy Application Management bằng `DEPLOY_PREVIEW`, sau đó chạy `Application Management Preview Stack Verify` với `full-stack`.

## 7. Pha D · E2E control-plane

Dùng synthetic devices/data và kiểm tra:

1. dashboard đọc trạng thái thật từ client-owned registry;
2. `Website` mở user runtime, không mở admin;
3. Health: pending → approve → session → block → revoke;
4. RU_LIFE: pending → bind identity → approve → block → read-back;
5. Bauman: pending → idempotent approve → Learning Runtime mở → block/revoke → runtime bị chặn;
6. Bơi ếch: pending → approve; spam removal vẫn là semantics riêng;
7. mọi mutation chỉ báo thành công sau read-back từ client sở hữu registry;
8. refresh/focus sync chỉ đọc ngoài policy rõ ràng;
9. không sao chép health/profile/private data vào central control-plane.

## 8. Điều kiện trước production

Không chuẩn bị production promotion cho tới khi:

- CI và preview artifact gates xanh;
- production D1 guards đầy đủ;
- preview migrations pass;
- Application Management anonymous access bị chặn 401;
- preview secret read-back pass;
- browser preview login pass;
- full-stack verifier pass;
- E2E mutation/read-back pass;
- Bauman Control/Runtime tách origin đúng;
- không client nào dùng `*.chatgpt.site` fallback;
- production vẫn manual/guarded.

Cơ chế access cho production sẽ được quyết định riêng; preview secret gate không tự động trở thành production authentication.

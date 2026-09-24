# Cloudflare deployment track

## Trạng thái

Cloudflare là môi trường preview/production thay thế ChatGPT Sites. `Application-Management` vẫn là **control-plane canonical duy nhất**; mỗi ứng dụng tiếp tục sở hữu runtime, database, registry thiết bị và audit của chính nó.

Preview Application Management **không phụ thuộc Cloudflare Zero Trust**. Lớp bảo vệ preview nằm ngay tại Worker trong `worker/preview-access.ts` và dùng secret riêng `APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET`.

`LOCAL_DEV_AUTH` chỉ dùng loopback local và tuyệt đối không được materialize lên Cloudflare.

## Kiến trúc preview

```text
Browser / GitHub Actions
        ↓
Application Management Worker
        ↓ application-level preview secret gate
        ├─ Browser: secret -> signed HttpOnly session cookie
        └─ CI: Authorization: Bearer <preview secret>
        ↓
Internal preview-owner identity bridge
        ↓
QT device + role authorization
        ↓ D1 riêng của control-plane
Application Management D1
        ↓ app-scoped Control API
Health_Care / RU_LIFE / Bauman Control / Bơi Ếch
```

Secret không nằm trong URL, không nằm trong Wrangler vars và không commit vào Git. Browser nhập secret tại `/__preview-login`; Worker đổi nó thành session cookie ký HMAC-SHA-256, `HttpOnly`, `Secure`, `SameSite=Strict`.

## Local / preview / production tách D1 tuyệt đối

Local Application Management dùng UUID giả riêng:

```text
00000000-0000-0000-0000-000000000003
```

Preview dùng `application-management-preview-db`. Materializer từ chối UUID local, legacy ChatGPT Sites D1 `1cf8f6b4-6c23-4479-8751-47703ecac92b`, production ID sai định dạng và production ID trùng preview.

`APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID` là guard bắt buộc nhưng production D1 không được bind vào preview Worker.

## GitHub Environment `application-management-preview`

Secrets bắt buộc pha A:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID
APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID
APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET
```

`APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET` phải dài ít nhất 32 ký tự và chỉ được cài lên Worker bằng `wrangler secret put`.

Variables bắt buộc pha A:

```text
CONTROL_OWNER_EMAILS
APPLICATION_MANAGEMENT_PREVIEW_ORIGIN
```

Không còn cần:

```text
CF_ACCESS_CLIENT_ID
CF_ACCESS_CLIENT_SECRET
CF_ACCESS_TEAM_DOMAIN
CF_ACCESS_AUD
```

Secrets app-scoped khi client tương ứng được nối:

```text
CONTROL_SERVICE_SECRET
HEALTH_CONTROL_SERVICE_SECRET
RU_LIFE_CONTROL_SERVICE_SECRET
BAUMAN_CONTROL_SERVICE_SECRET
```

Client preview origins chỉ đặt khi preview thật đã tồn tại:

```text
BOI_ECH_PREVIEW_ORIGIN
HEALTH_CARE_PREVIEW_ORIGIN
RU_LIFE_PREVIEW_ORIGIN
BAUMAN_CONTROL_PREVIEW_ORIGIN
BAUMAN_RUNTIME_PREVIEW_ORIGIN
GROWUP_PREVIEW_ORIGIN
```

Bauman Control và Bauman Learning Runtime phải là hai HTTPS origin khác nhau. Không dùng `*.chatgpt.site` làm fallback.

## Workflow preview

`.github/workflows/deploy-application-management-preview.yml` là **manual-only**, yêu cầu nhập chính xác `DEPLOY_PREVIEW`.

Trình tự stop-on-error:

1. kiểm Cloudflare credentials, hai D1 ID, preview access secret, owner policy và preview origin;
2. chạy regression;
3. validate preview boundary;
4. materialize `wrangler.cloudflare.jsonc`;
5. validate materialized config;
6. apply migrations chỉ vào `application-management-preview-db`;
7. build bằng preview bindings;
8. kiểm generated artifact;
9. deploy Worker;
10. cài/rotate `APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET` bằng Wrangler secret;
11. cài các bridge secret nếu client tương ứng đã cấu hình;
12. gọi anonymous `/__deployment` và **bắt buộc nhận HTTP 401**;
13. gọi lại bằng `Authorization: Bearer <preview secret>` và read-back identity/channel/revision/D1/access/owner/network-mode.

Nếu secret chưa được cài hoặc ngắn hơn 32 ký tự, preview phải fail-closed.

## `/__deployment`

Endpoint công bố thông tin không nhạy cảm:

- application/runtime/channel/revision;
- trạng thái schema D1;
- `previewAccessConfigured`;
- `accessMode=application-preview-secret`;
- owner policy;
- network mode;
- trạng thái client origins.

Anonymous request tới endpoint này phải bị Worker trả 401 ở preview. Endpoint không chứa secret.

## Browser preview access

Khi mở preview bằng trình duyệt mà chưa có session, Worker chuyển tới `/__preview-login`. Người quản trị nhập `APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET`; secret được gửi bằng POST form, không đặt trong query string. Sau khi hợp lệ, Worker tạo signed session cookie 12 giờ.

Worker xóa/ghi đè mọi header identity do client tự gửi và chỉ tạo preview-owner identity sau khi preview gate pass. Owner email lấy từ `CONTROL_OWNER_EMAILS`.

## CI và verifier

`cloudflare-preview-ci.yml` chỉ chạy PR dry-run, không deploy thật.

`Application Management Preview Stack Verify` là read-only. Nó kiểm:

- anonymous `/__deployment` = 401;
- bearer preview secret đọc được deployment metadata;
- D1 ready;
- preview access gate configured;
- owner policy configured;
- network mode production;
- khi full-stack: CORS/status/ownership của các client và Bauman Control/Runtime linkage.

## Production

Preview không tự promote Production. Production là track riêng:

- Worker `application-management`;
- D1 `application-management-production-db`, không trùng Preview/local/legacy Sites;
- channel `cloudflare-production`;
- `assets.run_worker_first=true` để account authentication chạy trước mọi static asset;
- đăng nhập email + mật khẩu của Application Management, không dùng Preview access secret;
- mật khẩu băm PBKDF2-SHA-256 với salt ngẫu nhiên;
- session cookie `__Host-am_prod_session`, `HttpOnly + Secure + SameSite=Strict`;
- khóa 15 phút sau 5 lần đăng nhập sai liên tiếp;
- role Owner được lưu trong D1 để đổi email không làm mất quyền;
- `APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET` chỉ dùng cho deployment health/read-back;
- workflow Production manual-only, yêu cầu `DEPLOY_PRODUCTION`.

Runbook chi tiết: `docs/CLOUDFLARE_PRODUCTION_RUNBOOK.md`.

Production chỉ được deploy sau khi CI, Production dry-run, D1 migration boundary, generated artifact guard và Preview regressions đều pass.

## No-publish QA checkpoint

Sau khi hợp nhất giao diện chính theo mẫu đã duyệt, có thể dùng một PR tài liệu chạm vào file này để kích hoạt `Application Management Cloudflare Preview CI`. Workflow đó chỉ chạy regression, materialize cấu hình preview, build với preview bindings, kiểm artifact và `wrangler deploy --dry-run`; **không deploy preview và không publish production**. Đây là checkpoint phù hợp trước khi thực hiện bất kỳ publish nào.
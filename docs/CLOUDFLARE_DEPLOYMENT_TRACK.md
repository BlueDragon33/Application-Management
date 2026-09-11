# Cloudflare deployment track

## Trạng thái

Cloudflare là môi trường preview/production thay thế ChatGPT Sites. `Application-Management` vẫn là **control-plane canonical duy nhất**; mỗi ứng dụng tiếp tục sở hữu runtime, database, registry thiết bị và audit của chính nó.

Cloudflare path đã có Access Auth Adapter trong `app/cloudflare-access-auth.ts`: xác minh `Cf-Access-Jwt-Assertion` bằng JWKS, RS256, issuer, audience, thời hạn và subject/email. `LOCAL_DEV_AUTH` chỉ dùng loopback local và tuyệt đối không được materialize vào Cloudflare.

Preview **không còn copy config thủ công**. `wrangler.cloudflare.example.jsonc` là template; `scripts/prepare-cloudflare-preview.mjs` tạo file ignored `wrangler.cloudflare.jsonc` sau khi kiểm tra D1, Access, owner policy và client origins.

## Kiến trúc đích

```text
Browser
  ↓
Cloudflare Access
  ↓ Cf-Access-Jwt-Assertion
Application Management
  ↓ verify RS256 + JWKS + issuer + AUD + exp/nbf
QT device + role authorization
  ↓ D1 riêng của control-plane
Application Management D1
  ↓ signed app-scoped Control API
Health_Care / RU_LIFE / Bauman Control / Bơi Ếch

Bauman riêng:
Bauman Learning Runtime ── P-256 Device Gate ──> Bauman Control Service ──> Bauman D1
```

Application Management không nhập database/client data vào control-plane. `GROWUP_BASE_URL` hiện chỉ dùng contract/direct launch cho tới khi GrowUP có remote-admin contract đầy đủ.

## Local / offline và Cloudflare tách D1 tuyệt đối

Local Application Management dùng `wrangler.local.jsonc` với UUID giả riêng:

```text
00000000-0000-0000-0000-000000000003
```

UUID này chỉ dành cho Wrangler local. Preview materializer từ chối UUID local, từ chối legacy ChatGPT Sites D1 `1cf8f6b4-6c23-4479-8751-47703ecac92b`, và nếu được cung cấp thì cũng từ chối `APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID` trùng preview.

`vite.config.ts` chạy hai đường rõ ràng:

- local/dev: binding D1 local-only và các local env chỉ ở `serve`;
- Cloudflare build: chỉ dùng config được chỉ định qua `CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH`.

Như vậy build preview không thể vô tình lấy binding D1 cũ từ ChatGPT Sites.

## Preview Cloudflare

Workflow `.github/workflows/deploy-application-management-preview.yml` là **manual-only**. Không có `push` auto-deploy. Người vận hành phải nhập chính xác `DEPLOY_PREVIEW`.

GitHub Environment `application-management-preview` cần cấu hình:

```text
Secrets bắt buộc:
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID
CF_ACCESS_CLIENT_ID
CF_ACCESS_CLIENT_SECRET

Secrets app-scoped khi client tương ứng được cấu hình:
CONTROL_SERVICE_SECRET
HEALTH_CONTROL_SERVICE_SECRET
RU_LIFE_CONTROL_SERVICE_SECRET
BAUMAN_CONTROL_SERVICE_SECRET

Secret guard khuyến nghị:
APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID

Variables bắt buộc:
CONTROL_OWNER_EMAILS
CF_ACCESS_TEAM_DOMAIN
CF_ACCESS_AUD
APPLICATION_MANAGEMENT_PREVIEW_ORIGIN

Variables client preview, chỉ đặt khi client đó đã có preview thật:
BOI_ECH_PREVIEW_ORIGIN
HEALTH_CARE_PREVIEW_ORIGIN
RU_LIFE_PREVIEW_ORIGIN
BAUMAN_CONTROL_PREVIEW_ORIGIN
BAUMAN_RUNTIME_PREVIEW_ORIGIN
GROWUP_PREVIEW_ORIGIN
```

Bauman Control và Bauman Learning Runtime phải được cấu hình cùng nhau và phải là hai HTTPS origin khác nhau. Mọi client origin mới đều bị từ chối nếu trỏ về `*.chatgpt.site`.

## Trình tự workflow preview

Workflow thực hiện stop-on-error theo thứ tự:

1. xác minh confirmation, Cloudflare credentials, Access service token và policy variables;
2. `npm ci`, sau đó chạy toàn bộ regression hiện có trước khi materialize preview;
3. chạy `validate:cloudflare-preview`;
4. materialize `wrangler.cloudflare.jsonc`;
5. chạy `cloudflare:check` lần nữa trên config thật;
6. apply migrations chỉ vào `application-management-preview-db`;
7. build với `CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH=wrangler.cloudflare.jsonc`;
8. kiểm artifact không chứa legacy/local D1;
9. deploy generated Worker artifact;
10. cài/rotate từng app-scoped secret chỉ khi client tương ứng được cấu hình;
11. gọi preview không token và **bắt buộc không được HTTP 200**;
12. gọi `/__deployment` qua Cloudflare Access service token và read-back: đúng application/channel/revision, D1 ready, Access configured, owner policy configured, network mode `production`.

CI `.github/workflows/cloudflare-preview-ci.yml` chỉ chạy ở pull request và chỉ dry-run; CI không có quyền deploy preview/production.

## `/__deployment`

`worker/index.ts` có endpoint read-back không chứa secret hoặc dữ liệu người dùng. Endpoint chỉ công bố deployment identity/revision/channel, trạng thái schema D1, Access/owner config, network mode và cờ client-origin đã cấu hình.

Endpoint này **không thay Cloudflare Access**. Preview workflow yêu cầu Access chặn request ẩn danh trước, sau đó mới đọc endpoint bằng service token. Nếu request ẩn danh nhận HTTP 200 thì deployment workflow fail.

## Cloudflare Access

Trước khi chạy deploy preview phải tạo Access Application/Policy bảo vệ đúng `APPLICATION_MANAGEMENT_PREVIEW_ORIGIN`. Service token dùng bởi GitHub Actions phải được allow trong policy. Human admin vẫn đăng nhập qua Access identity; service token chỉ dùng cho deployment read-back và không thay thế user identity/role.

Ứng dụng tiếp tục xác thực JWT ở origin bằng `CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD`; không tin email header tự khai báo.

## Client origins

Production/preview Control API phải là HTTPS exact origin. Riêng Bauman:

```text
BAUMAN_CONTROL_BASE_URL=https://<bauman-control-worker>
BAUMAN_APP_ORIGIN=https://<bauman-learning-runtime>
```

`BAUMAN_CONTROL_BASE_URL` dùng cho remote admin. `BAUMAN_APP_ORIGIN` là website học và là origin device gateway. Không fallback runtime sang Control Service.

Local tương ứng:

```text
BAUMAN_CONTROL_LOCAL_BASE_URL=http://127.0.0.1:3003
BAUMAN_APP_LOCAL_ORIGIN=http://127.0.0.1:3005
```

## Secrets

Không ghi secret vào Git, template, README, PR body hoặc chat. Các app-scoped secret hiện gồm:

```text
CONTROL_SERVICE_SECRET              # Bơi ếch
HEALTH_CONTROL_SERVICE_SECRET       # Health_Care
RU_LIFE_CONTROL_SERVICE_SECRET      # RU_LIFE
BAUMAN_CONTROL_SERVICE_SECRET       # Bauman
```

Health không fallback sang generic secret. GrowUP hiện không có shared control secret trong bridge hiện hành.

## Production Cloudflare

Preview không tự promote production. Chỉ tạo/chạy production promotion sau khi:

- GitHub regression + Cloudflare dry-run đạt;
- preview D1 migrations và `/__deployment` read-back đạt;
- Cloudflare Access thực sự chặn anonymous request;
- human Access login + QT device gate được kiểm tra;
- từng client bridge được live-probe và mutation/read-back đúng semantics;
- Bauman Control và Learning Runtime đều live và Device Gate trỏ đúng control origin;
- không còn client nào cần fallback `chatgpt.site` trong production config.

Không coi CI xanh là production đã deploy. Không thay URL cũ hoặc tắt rollback path trước khi production read-back pass.

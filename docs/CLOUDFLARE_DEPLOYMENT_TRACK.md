# Cloudflare deployment track

## Trạng thái

Cloudflare được chuẩn bị như môi trường preview/production thay thế. Access Auth Adapter V1 đã được triển khai trong `app/cloudflare-access-auth.ts`; trước preview thật vẫn cần cấu hình tài khoản Cloudflare, preview D1, Team Domain, AUD, Access policy, secrets và hostname/Worker.

ChatGPT Site có thể nhận dạng người dùng bằng `oai-authenticated-user-*`. Cloudflare không tạo các header đó, nên Cloudflare path dùng `Cf-Access-Jwt-Assertion` và xác minh chữ ký/issuer/audience độc lập.

## Kiến trúc đích

```text
Browser
  ↓
Cloudflare Access
  ↓ Cf-Access-Jwt-Assertion
Application Management
  ↓ verify RS256 + JWKS + issuer + AUD + exp/nbf
Control-plane authorization (QT device + role)
  ↓ D1 binding riêng
Application Management D1
  ↓ signed client-control contracts
Health_Care / RU_LIFE / Bauman Control / Bơi Ếch

Bauman riêng:
Bauman Learning Runtime ── P-256 Device Gate ──> Bauman Control Service ──> Bauman D1
```

Application Management vẫn chỉ là Control Plane. Không nhập runtime/client database vào Worker này.

## Access Auth Adapter V1

Adapter hiện tại chỉ chấp nhận Team Domain hợp lệ, lấy JWKS từ Cloudflare Access, chỉ nhận RS256, kiểm tra `kid`/signature/issuer/audience/exp/nbf/iat, yêu cầu `sub` và email hợp lệ, cache JWKS ngắn hạn và không dùng `LOCAL_DEV_AUTH` trên production. Cloudflare Access chỉ xác thực danh tính; quyền quản trị vẫn qua thiết bị `QT-` + role của Application Management.

## Giai đoạn 1 — Preview Cloudflare

1. Tạo D1 preview riêng cho Application Management.
2. Copy `wrangler.cloudflare.example.jsonc` thành `wrangler.cloudflare.jsonc`.
3. Thay `database_id` placeholder bằng D1 preview ID.
4. Tạo/protect Worker hoặc hostname preview bằng Cloudflare Access.
5. Lấy Team Domain và Application Audience (AUD).
6. Ghi `CF_ACCESS_TEAM_DOMAIN` và `CF_ACCESS_AUD` vào variables của preview.
7. Đặt các base URL client phù hợp preview.
8. Đặt secrets bằng Wrangler hoặc Cloudflare Dashboard.
9. Chạy `npm run cloudflare:check`.
10. Apply migrations vào D1 preview.
11. Build + deploy Worker preview.
12. Smoke test Access login → QT device registration/proof → control bridge.

## Origin production của client

Các Control API phải là HTTPS. Với Bauman, tuyệt đối không dùng một URL cho cả website học và backend quản trị:

```text
BAUMAN_CONTROL_BASE_URL=https://<bauman-control-worker>
BAUMAN_APP_ORIGIN=https://<bauman-learning-runtime>
```

`BAUMAN_CONTROL_BASE_URL` chỉ dành cho Application Management gọi Control API. `BAUMAN_APP_ORIGIN` là website người học và là đích của `Truy cập web`. Cùng `BAUMAN_APP_ORIGIN` phải được đặt ở Bauman Control Service để giới hạn CORS/device gateway đúng runtime.

Nếu `BAUMAN_APP_ORIGIN` chưa có hoặc runtime chưa phản hồi, Application Management phải tắt direct web access; không được fallback sang `BAUMAN_CONTROL_BASE_URL`.

Các origin local tương ứng là `BAUMAN_CONTROL_LOCAL_BASE_URL=http://127.0.0.1:3003` và `BAUMAN_APP_LOCAL_ORIGIN=http://127.0.0.1:3005`.

## Secrets

Không ghi secret vào Git, `.dev.vars.example`, `wrangler.cloudflare.example.jsonc`, README hoặc PR body.

Các secret app-scoped gồm `CONTROL_SERVICE_SECRET`, `HEALTH_CONTROL_SERVICE_SECRET`, `RU_LIFE_CONTROL_SERVICE_SECRET` và `BAUMAN_CONTROL_SERVICE_SECRET`. Health không được fallback sang generic secret.

## Lệnh preview sau khi có thông tin tài khoản Cloudflare

```bash
npm ci
npm test
npm run cloudflare:check
npx wrangler d1 migrations apply application-management-preview-db --remote --config wrangler.cloudflare.jsonc
npm run build
npx wrangler deploy --config wrangler.cloudflare.jsonc
```

Dùng `--remote` cho migration Cloudflare chỉ khi chắc chắn config đang trỏ tới preview D1 đúng môi trường.

## Cloudflare Access gate

Trước khi deploy quản trị lên Internet phải có `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` và Access policy bảo vệ chính Worker/hostname. Adapter trong ứng dụng xác minh lại JWT; không tin header email tự khai báo.

## Production Cloudflare

Chỉ chuyển từ preview sang production khi local review đạt, GitHub CI đạt, Cloudflare preview build/contract test đạt, Access authentication đạt, D1 preview migrations đạt, client bridges hoạt động đúng, không có local auth trên hostname public và không có dữ liệu riêng tư của client bị sao chép về Application Management.

Riêng Bauman phải kiểm tra độc lập cả hai endpoint: Control Service production và Learning Runtime production. Chỉ khi cả hai live, runtime Device Gate dùng đúng Control Service, nút Website mở đúng runtime và BM registry/approve/block/read-back hoạt động thật mới chuyển metadata từ `migrating` sang `connected`.

## Tài liệu Cloudflare nền

- Workers local development: https://developers.cloudflare.com/workers/local-development/
- D1 local development: https://developers.cloudflare.com/d1/best-practices/local-development/
- Workers Vite plugin: https://developers.cloudflare.com/workers/vite-plugin/
- Workers secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Cloudflare Access for Workers: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- Validate Access JWT: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/

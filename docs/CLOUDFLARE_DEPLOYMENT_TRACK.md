# Cloudflare deployment track

## Trạng thái

Cloudflare được chuẩn bị như **môi trường preview/production thay thế**. Access Auth Adapter V1 đã được triển khai trong `app/cloudflare-access-auth.ts`; bước còn thiếu trước preview thật là cấu hình tài khoản Cloudflare (preview D1, Team Domain, AUD, Access policy, secrets và hostname/Worker).

ChatGPT Site vẫn nhận dạng người dùng bằng `oai-authenticated-user-*`. Cloudflare không tạo các header đó, nên Cloudflare path dùng `Cf-Access-Jwt-Assertion` và xác minh chữ ký/issuer/audience độc lập.

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
Health_Care / RU_LIFE / Bauman / Bơi Ếch
```

Application Management vẫn chỉ là Control Plane. Không nhập runtime/client database vào Worker này.

## Access Auth Adapter V1

Adapter hiện tại:

- chỉ chấp nhận Team Domain dạng `https://<team>.cloudflareaccess.com`;
- lấy JWKS tại `/cdn-cgi/access/certs`;
- chỉ chấp nhận `RS256`;
- kiểm tra `kid`, RSA signing key, chữ ký WebCrypto;
- kiểm tra issuer, audience, expiration, not-before và issued-at với clock skew nhỏ;
- yêu cầu `sub` và email hợp lệ;
- cache JWKS ngắn hạn để tránh fetch cert ở mọi request;
- không sử dụng `LOCAL_DEV_AUTH`;
- ChatGPT Sites identity vẫn được ưu tiên khi `oai-authenticated-user-*` tồn tại;
- local identity chỉ đứng trước Cloudflare identity trên loopback host.

Cloudflare Access chỉ xác thực danh tính. Quyền quản trị thực tế vẫn tiếp tục qua `QT-` device + role của Application Management.

## Giai đoạn 1 — Preview Cloudflare

1. Tạo D1 **preview riêng**.
2. Copy `wrangler.cloudflare.example.jsonc` thành `wrangler.cloudflare.jsonc`.
3. Thay `database_id` placeholder bằng D1 preview ID.
4. Tạo/protect Worker hoặc hostname preview bằng Cloudflare Access.
5. Lấy Team Domain và Application Audience (AUD).
6. Ghi `CF_ACCESS_TEAM_DOMAIN` và `CF_ACCESS_AUD` vào config/variables của môi trường preview.
7. Đặt các base URL client phù hợp preview.
8. Đặt secrets bằng Wrangler hoặc Cloudflare Dashboard.
9. Chạy `npm run cloudflare:check`.
10. Apply migrations vào D1 preview.
11. Build + deploy Worker preview.
12. Smoke test Access login → QT device registration/proof → control bridge.

## Secrets

Không ghi secret vào Git, `.dev.vars.example`, `wrangler.cloudflare.example.jsonc`, README hoặc PR body.

Các secret app-scoped hiện có thể gồm:

- `CONTROL_SERVICE_SECRET` cho integration còn dùng contract này;
- `HEALTH_CONTROL_SERVICE_SECRET`;
- `RU_LIFE_CONTROL_SERVICE_SECRET`;
- `BAUMAN_CONTROL_SERVICE_SECRET`.

Health không được fallback từ `HEALTH_CONTROL_SERVICE_SECRET` sang generic `CONTROL_SERVICE_SECRET`.

## Lệnh preview sau khi có thông tin tài khoản Cloudflare

```bash
npm ci
npm test
npm run cloudflare:check
npx wrangler d1 migrations apply application-management-preview-db --remote --config wrangler.cloudflare.jsonc
npm run build
npx wrangler deploy --config wrangler.cloudflare.jsonc
```

Dùng `--remote` cho migration Cloudflare chỉ khi chắc chắn config đang trỏ tới **preview D1** đúng môi trường.

## Cloudflare Access gate

Trước khi deploy quản trị lên Internet phải có cả hai:

- `CF_ACCESS_TEAM_DOMAIN`
- `CF_ACCESS_AUD`

và Access policy phải bảo vệ chính Worker/hostname preview. Adapter trong ứng dụng xác minh lại JWT; không tin một header email tự khai báo.

Cloudflare hiện cũng cung cấp Worker-level Access và `ctx.access`; adapter V1 vẫn chủ động xác minh JWT để không phụ thuộc việc framework Next/vinext có chuyển `ExecutionContext` Access identity vào các server component hay không.

## Production Cloudflare

Chỉ chuyển từ preview sang production khi:

- local review đạt;
- GitHub CI đạt;
- Cloudflare preview build/contract test đạt;
- Access authentication đạt;
- D1 preview migrations đạt;
- client bridges hoạt động đúng;
- không có local auth trên hostname public;
- không có Health private data trong Application Management.

Sau đó mới tạo production D1/Worker/custom domain và secrets riêng.

## Tài liệu Cloudflare nền

- Workers local development: https://developers.cloudflare.com/workers/local-development/
- D1 local development: https://developers.cloudflare.com/d1/best-practices/local-development/
- Workers Vite plugin: https://developers.cloudflare.com/workers/vite-plugin/
- Workers secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Cloudflare Access for Workers: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- Validate Access JWT: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/

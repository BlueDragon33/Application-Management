# Cloudflare deployment track

## Trạng thái

Cloudflare được chuẩn bị như **môi trường preview/production thay thế**, nhưng không được triển khai công khai cho Application Management cho đến khi lớp xác thực Cloudflare Access được hoàn thiện và kiểm tra.

Lý do: ChatGPT Site hiện nhận dạng người dùng bằng `oai-authenticated-user-*`. Cloudflare không tự tạo các header ChatGPT này.

## Kiến trúc đích

```text
Browser
  ↓
Cloudflare Access
  ↓ JWT đã được kiểm tra
Application Management Worker
  ↓ D1 binding riêng
Application Management D1
  ↓ signed client-control contracts
Health_Care / RU_LIFE / Bauman / Bơi Ếch
```

Application Management vẫn chỉ là Control Plane. Không nhập runtime/client database vào Worker này.

## Giai đoạn 1 — Preview Cloudflare

1. Tạo D1 **preview riêng**.
2. Copy `wrangler.cloudflare.example.jsonc` thành `wrangler.cloudflare.jsonc`.
3. Thay `database_id` placeholder bằng D1 preview ID.
4. Tạo Cloudflare Access application cho hostname preview.
5. Lấy Team Domain và Application Audience (AUD).
6. Hoàn thiện adapter xác thực `Cf-Access-Jwt-Assertion` trước khi mở quyền quản trị.
7. Đặt các base URL client phù hợp preview.
8. Đặt secrets bằng Wrangler hoặc Cloudflare Dashboard.
9. Apply migrations vào D1 preview.
10. Build + deploy Worker preview.

## Secrets

Không ghi secret vào Git, `.dev.vars.example`, `wrangler.cloudflare.example.jsonc`, README hoặc PR body.

Các secret app-scoped hiện có thể gồm:

- `CONTROL_SERVICE_SECRET` cho integration còn dùng contract này;
- `HEALTH_CONTROL_SERVICE_SECRET`;
- `RU_LIFE_CONTROL_SERVICE_SECRET`;
- `BAUMAN_CONTROL_SERVICE_SECRET`.

Health không được fallback từ `HEALTH_CONTROL_SERVICE_SECRET` sang generic `CONTROL_SERVICE_SECRET`.

## Lệnh dự kiến sau khi adapter Access sẵn sàng

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

và code phải cryptographically validate `Cf-Access-Jwt-Assertion`/AUD hoặc sử dụng một cơ chế Access đã được xác minh tương đương.

Không chỉ tin một header email tự khai báo.

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

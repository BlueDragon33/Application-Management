# Cloudflare Production · Application Management

## Mục tiêu

Production là môi trường sử dụng thật, tách hoàn toàn khỏi Cloudflare Preview và ChatGPT Sites.

- Worker: `application-management`
- D1: `application-management-production-db`
- Channel: `cloudflare-production`
- Auth: tài khoản email + mật khẩu của Application Management
- Preview secret: **không được dùng ở Production**
- Deploy: manual-only bằng workflow `Application Management Cloudflare Production Deploy`

## Kiến trúc xác thực

```text
Browser
  ↓
Cloudflare Worker (run_worker_first=true)
  ↓
/__login
  ├─ email
  ├─ PBKDF2-SHA-256 + random salt
  ├─ lock 15 phút sau 5 lần sai
  └─ D1 control_accounts
  ↓
__Host-am_prod_session
HttpOnly + Secure + SameSite=Strict
  ↓
Worker xác minh session
  ↓
Worker xóa header identity do client tự gửi
  ↓
Worker chèn identity nội bộ
  ↓
Application Management + kiểm soát thiết bị QT
```

Static assets cũng phải đi qua Worker trước. Không được tắt `assets.run_worker_first=true`.

## GitHub Environment

Tạo Environment:

```text
application-management-production
```

### Secrets bắt buộc

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID
APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID
APPLICATION_MANAGEMENT_INITIAL_ADMIN_PASSWORD
APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET
```

Yêu cầu:

- Production D1 và Preview D1 tuyệt đối không được trùng UUID.
- `APPLICATION_MANAGEMENT_INITIAL_ADMIN_PASSWORD`: ít nhất 14 ký tự, chỉ dùng để bootstrap Owner đầu tiên.
- `APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET`: ít nhất 32 ký tự, chỉ dùng cho workflow đọc `/__deployment`, không dùng đăng nhập trình duyệt.
- Không commit secrets vào Git.
- Không đặt hai secret trên vào Wrangler vars.

### Variables bắt buộc

```text
CONTROL_OWNER_EMAILS
APPLICATION_MANAGEMENT_PRODUCTION_ORIGIN
```

`CONTROL_OWNER_EMAILS` dùng để xác định Owner được phép bootstrap lần đầu. Sau khi account Production được tạo, role `owner` được lưu trong D1, nên đổi email đăng nhập không làm mất quyền Owner.

Production origin ví dụ:

```text
https://application-management.<workers-subdomain>.workers.dev
```

Không dùng `*.chatgpt.site`.

### Client origins tùy chọn

Chỉ cấu hình khi client Production thật đã tồn tại:

```text
BOI_ECH_PRODUCTION_ORIGIN
HEALTH_CARE_PRODUCTION_ORIGIN
RU_LIFE_PRODUCTION_ORIGIN
BAUMAN_CONTROL_PRODUCTION_ORIGIN
BAUMAN_RUNTIME_PRODUCTION_ORIGIN
GROWUP_PRODUCTION_ORIGIN
```

Nếu bật client nào thì bridge secret tương ứng cũng phải có.

## Deploy Production

Workflow:

```text
Application Management Cloudflare Production Deploy
```

Nhập chính xác:

```text
DEPLOY_PRODUCTION
```

Workflow theo thứ tự fail-closed:

1. xác minh secrets/variables;
2. xác minh Production D1 khác Preview D1;
3. chạy toàn bộ regression tests;
4. materialize `wrangler.production.jsonc`;
5. validate Production boundary;
6. apply migrations vào Production D1;
7. build với Production bindings;
8. validate generated artifact;
9. deploy Worker `application-management`;
10. cài Worker secrets;
11. kiểm `/__login` trả 200 và không chứa Preview wording;
12. kiểm anonymous `/__deployment` trả 401;
13. đọc `/__deployment` bằng production read-back secret;
14. xác minh channel, D1, auth mode, owner policy và network mode.

Không có push auto-deploy.

## Đăng nhập lần đầu

Owner đầu tiên dùng:

- email đầu tiên trong `CONTROL_OWNER_EMAILS`;
- mật khẩu trong `APPLICATION_MANAGEMENT_INITIAL_ADMIN_PASSWORD`.

Khi account chưa tồn tại, Worker tạo account Owner trong D1 và đánh dấu `must_change_password=1`.

Sau đăng nhập đầu tiên, hệ thống đưa thẳng tới:

```text
/__account
```

Đổi mật khẩu ngay. Mật khẩu mới phải tối thiểu 12 ký tự.

## Tài khoản & bảo mật

Production quản lý trực tiếp tại `/__account`:

- tên hiển thị;
- số điện thoại;
- đổi email đăng nhập;
- đổi mật khẩu;
- đăng xuất.

Đổi email bắt buộc nhập lại mật khẩu hiện tại. Hệ thống cập nhật đồng bộ:

- `control_accounts`;
- `control_members`;
- `control_devices`;
- session state.

Sau khi đổi email, mọi session hiện tại bị thu hồi và phải đăng nhập lại.

Role Owner được đọc từ D1 trước, `CONTROL_OWNER_EMAILS` chỉ là fallback/bootstrap.

## Preview vẫn giữ nguyên

Preview:

```text
https://application-management-preview.<workers-subdomain>.workers.dev
```

vẫn dùng Preview access secret và chỉ dành cho kiểm thử.

Production không được chuyển thành Preview bằng cách đổi channel hoặc tái sử dụng Preview D1/secret.


## Giới hạn PBKDF2 trên Cloudflare Workers

Production pin PBKDF2-SHA-256 ở 100.000 iterations vì Cloudflare Workers production từ chối giá trị lớn hơn 100.000. CI kiểm trực tiếp constant này để tránh local/dry-run xanh nhưng live login thất bại.

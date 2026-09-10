# Local-first release standard

## Mục tiêu

Giảm vòng lặp tốn quota/credit bằng cách tách ba môi trường rõ ràng:

1. **GitHub** = nguồn mã chuẩn.
2. **Local PC** = nơi review giao diện, chạy full-stack local và sửa lỗi nhanh.
3. **Hosted production** (`chatgpt.site` hoặc Cloudflare) = chỉ cập nhật sau khi local + CI đã đạt.

Không publish chỉ để xem CSS/UI đã đổi hay chưa.

## Quy trình bắt buộc

### A. Phát triển

- Tạo branch trên GitHub.
- Sửa code.
- Chạy test/CI.
- Chỉ merge `main` khi gate xanh.

### B. Review local trên Windows

Sau khi merge:

1. Mở GitHub Desktop.
2. Chọn `BlueDragon33/Application-Management`.
3. `Fetch origin` → `Pull origin`.
4. Nhấp đúp `RUN_LOCAL.bat`.
5. Trình duyệt mở `http://127.0.0.1:3000`.
6. Review UI và logic local.
7. Nếu chưa đạt: chụp màn hình local → sửa tiếp qua GitHub. Không publish hosted Site.

`RUN_LOCAL.bat` tự:

- cài dependency bằng `npm ci` nếu máy chưa có `node_modules`;
- tạo `.dev.vars` local-only từ `.dev.vars.example` nếu chưa có;
- apply D1 migrations vào **D1 local**;
- chạy Vite + Cloudflare Workers runtime ở localhost;
- mở trình duyệt.

## Local auth

ChatGPT Sites production vẫn dùng các header `oai-authenticated-user-*`.

Local PC không có các header đó. Vì vậy code có một local identity bridge với các rào chắn:

- phải có `LOCAL_DEV_AUTH=1`;
- request host bắt buộc là `localhost`, `127.0.0.1` hoặc `[::1]`;
- local identity nằm trong `.dev.vars`, file này không được commit;
- production request không thể dùng local fallback chỉ bằng cách thiếu ChatGPT header.

Không được mở rộng local auth sang LAN IP hoặc hostname public.

## D1 local

`wrangler.local.jsonc` dùng cùng schema/binding name `DB` nhưng `--local` làm việc với D1 mô phỏng riêng trên máy.

Dữ liệu local không phải dữ liệu production. Không thêm `remote: true` vào local config.

## Full-stack local nhiều app

Quy ước port đề xuất:

- Application Management: `127.0.0.1:3000`
- Health_Care: `127.0.0.1:3001`
- RU_LIFE: `127.0.0.1:3002`
- Bauman: `127.0.0.1:3003`
- Bơi Ếch: `127.0.0.1:3004`

Mỗi app vẫn chạy runtime/database riêng. Application Management chỉ gọi client qua base URL + app-scoped local secret tương ứng.

Không chia sẻ database giữa các app chỉ vì đang chạy local.

## Gate trước khi publish

Chỉ publish khi cả bốn điều kiện đều đạt:

1. GitHub CI xanh.
2. `npm test` local xanh.
3. UI/logic local được review đạt.
4. Hosted settings/secrets đã được xác minh cho đúng môi trường.

Sau publish chỉ chạy smoke test production, không dùng production như môi trường thiết kế.

## Cloudflare track

Cloudflare là một deployment track riêng, không thay đổi ownership của các client.

Giai đoạn chuẩn:

1. Local-first ổn định.
2. Tạo **preview D1 riêng** trên Cloudflare.
3. Tạo Worker preview từ `wrangler.cloudflare.example.jsonc`.
4. Đặt Cloudflare Access phía trước Worker.
5. Triển khai adapter xác thực Cloudflare Access và kiểm tra JWT/AUD trước khi coi Cloudflare là môi trường quản trị hợp lệ.
6. Cấu hình secrets qua Wrangler/Dashboard, không commit vào Git.
7. Deploy preview.
8. Smoke test bridge/client contracts.
9. Chỉ sau đó mới cân nhắc custom domain/production Cloudflare.

Không dùng `LOCAL_DEV_AUTH` trên Cloudflare.

## Credit/quota principle

- Local execution, local browser review, GitHub Desktop pull và test trên PC không cần Work chạy hộ.
- Work/Codex chỉ nên dùng khi thật sự cần môi trường hosted/computer-use/publish.
- Mọi thay đổi có thể review bằng localhost phải hoàn tất trước khi gọi Work.

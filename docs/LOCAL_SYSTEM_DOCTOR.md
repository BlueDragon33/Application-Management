# Local System Doctor

`Local System Doctor` là gate đọc-only trước khi chạy toàn bộ Application Management ở máy cá nhân.

## Windows

Nhấp đúp:

```text
CHECK_LOCAL_SYSTEM.bat
```

Doctor chạy với `--strict-ports`: port 3000–3004 phải còn trống trước khi bật hệ thống.

Sau khi nhận `SẴN SÀNG`, chạy:

```text
RUN_LOCAL_SYSTEM.bat
```

## Terminal

Kiểm tra thông thường:

```bash
npm run local:doctor
```

Kiểm tra nghiêm ngặt trước khi start:

```bash
npm run local:doctor:strict
```

Nếu các repo không nằm chung thư mục cha:

```bash
node scripts/local-system-doctor.mjs --apps-root "D:\Apps" --strict-ports
```

Dùng cho script/automation:

```bash
node scripts/local-system-doctor.mjs --json
```

## Doctor kiểm tra gì

- Node.js >= 22.13.0;
- đủ `Application-Management`, `Health_Care`, `RU_LIFE`, `Bauman-master-ai-system/control-service`, `BOIECH_AI/boi-ech`;
- đủ local D1/Wrangler config cần thiết;
- resolver Production/Local/Hybrid và port chuẩn 3000–3004;
- bindings local của Health, RU_LIFE và Bơi ếch;
- cú pháp launcher;
- launcher local không chứa `--remote` hoặc endpoint `workers.dev`;
- trạng thái các port local.

## Ranh giới an toàn

Doctor **không** cài package, không chạy migration, không deploy, không ghi file, không sửa database và không in secret. Nó chỉ kiểm tra khả năng sẵn sàng của source/runtime trước khi `RUN_LOCAL_SYSTEM.bat` thực hiện các bước khởi động thật.

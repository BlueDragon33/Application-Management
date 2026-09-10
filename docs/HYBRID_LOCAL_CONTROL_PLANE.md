# Hybrid Local Control Plane

## Mục tiêu

Mỗi ứng dụng vẫn là một repo độc lập. `Application-Management` chỉ là control-plane và không gom source, registry hay database của client vào một repo chung.

Ba chế độ được chuẩn hóa:

- `production`: chỉ kết nối origin HTTPS production của từng client.
- `local`: chỉ kết nối các runtime loopback/private local được cấu hình.
- `hybrid`: thử local trước; nếu local không chạy thì fallback về production HTTPS đã cấu hình.

`LOCAL_DEV_AUTH=1` chỉ dành cho development loopback. Production tiếp tục dùng Cloudflare Access/ChatGPT authenticated headers theo auth chain hiện có.

## Bố cục thư mục trên máy

Các repo nên được clone làm thư mục anh em:

```text
D:\Apps\
├── Application-Management\
├── Health_Care\
├── RU_LIFE\
├── Bauman-master-ai-system\
└── BOIECH_AI\
    └── boi-ech\
```

Không dùng git submodule. Mỗi repo giữ lịch sử, branch, CI và release riêng.

## Port local chuẩn

| Runtime | Port | Origin |
| --- | ---: | --- |
| Application Management | 3000 | `http://127.0.0.1:3000` |
| Sức khỏe Y tế | 3001 | `http://127.0.0.1:3001` |
| Hòa nhập Nga | 3002 | `http://127.0.0.1:3002` |
| Bauman Control Service | 3003 | `http://127.0.0.1:3003` |
| Bơi ếch | 3004 | `http://127.0.0.1:3004` |

Các port mặc định chỉ bind loopback. Không đổi sang `0.0.0.0` để chia sẻ LAN trước khi lớp xác thực LAN được triển khai.

## Chạy toàn hệ thống trên Windows

Từ thư mục `Application-Management`:

```powershell
npm run local:system
```

hoặc nhấp đúp:

```text
RUN_LOCAL_SYSTEM.bat
```

Launcher sẽ:

1. kiểm tra Node.js >= 22.13;
2. kiểm tra đủ bốn repo client ở cạnh `Application-Management`;
3. cài dependency khi `node_modules` chưa tồn tại;
4. áp migration vào D1 **local** của từng repo;
5. tạo secret liên-app ngẫu nhiên chỉ trong process hiện tại;
6. khởi động Health, RU LIFE, Bauman Control và Bơi ếch;
7. chờ client sẵn sàng;
8. khởi động Application Management;
9. mở `http://127.0.0.1:3000`;
10. giữ tất cả runtime trong một phiên; `Ctrl+C` dừng toàn bộ.

Secret tạm thời không được ghi vào GitHub. `.dev.vars` của Application Management chỉ chứa danh tính local development và bị `.gitignore` loại khỏi source control.

Nếu muốn tự quản dependency/migration:

```powershell
node scripts/run-local-system.mjs --local --skip-install --skip-migrate
```

Nếu các repo không nằm chung thư mục cha:

```powershell
node scripts/run-local-system.mjs --local --apps-root "D:\Apps"
```

## Chế độ Hybrid

```powershell
npm run local:system:hybrid
```

Trong hybrid, resolver của Application Management thử Control API local trước. Nếu local không phản hồi trong thời gian probe ngắn, nó chỉ fallback sang origin production **HTTPS** được cấu hình.

HTTP public không bao giờ được coi là production origin. HTTP chỉ được chấp nhận cho localhost/private network trong local/hybrid.

## Dữ liệu offline

Local runtime sử dụng D1 local trong `.wrangler` của **từng repo**. Vì vậy:

- Health local không dùng D1 Health production;
- RU LIFE local không dùng registry HN- production;
- Bơi ếch local không dùng D1 Bơi ếch production;
- Application Management local không dùng D1 control-plane production.

Đây là isolation có chủ đích để thử nghiệm và sử dụng offline an toàn.

Phiên bản này **chưa đồng bộ hai chiều local ↔ production** và **chưa có hàng đợi lệnh offline gửi lên cloud**. Không được diễn giải snapshot local là trạng thái production.

## Ranh giới quản trị

Luồng local giữ nguyên kiến trúc client-owned:

```text
Application Management local
        │
        ├── signed Health bridge ──> Health local registry
        ├── opaque RU bridge ──────> RU LIFE local registry
        ├── signed Bơi ếch bridge ─> Bơi ếch local registry
        └── signed Bauman bridge ──> Bauman Control local
```

Application Management không đọc/ghi trực tiếp database chuyên môn của client.

## Bảo mật

Local dev identity chỉ được chấp nhận khi:

- môi trường development;
- `LOCAL_DEV_AUTH=1`;
- request tới loopback `localhost/127.0.0.1/[::1]`.

Không bật `LOCAL_DEV_AUTH` ở Cloudflare production. Production auth tiếp tục qua Cloudflare Access.

LAN mode chưa được bật trong launcher. Khi triển khai LAN phải có auth riêng (Access tunnel/VPN hoặc signed local session), không chỉ đổi host sang `0.0.0.0`.

## Gate trước khi merge/release

Mỗi client phải pass CI riêng trước. Sau đó Application Management phải pass build + toàn bộ contract/regression tests. Thứ tự merge khuyến nghị:

1. Health_Care;
2. RU_LIFE;
3. BOIECH_AI;
4. Application-Management.

Bauman Control hiện chỉ có readiness/control contract giới hạn; không được coi là có device registry hoàn chỉnh chỉ vì local service chạy được.

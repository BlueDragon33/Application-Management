# Hybrid Local Control Plane

## Mục tiêu

Mỗi ứng dụng vẫn là một repo độc lập. `Application-Management` chỉ là control-plane và không gom source, registry hay database của client vào một repo chung.

Ba chế độ được chuẩn hóa:

- `production`: chỉ kết nối origin HTTPS production của từng client.
- `local`: chỉ kết nối các runtime loopback/private local được cấu hình.
- `hybrid`: thử local trước; nếu local không chạy thì fallback về production HTTPS đã cấu hình.

`LOCAL_DEV_AUTH=1` chỉ dành cho development loopback. Production dùng Cloudflare Access/identity chain hiện có.

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
| Bauman Learning Runtime | 3005 | `http://127.0.0.1:3005` |

Bauman có **hai origin khác nhau**. `:3003` là backend quản trị/API, còn `:3005` là website học tập. Nút `Truy cập web` của Application Management chỉ được trỏ tới runtime `:3005`, không được mở Control Service `:3003`.

Các port mặc định chỉ bind loopback. Không đổi sang `0.0.0.0` để chia sẻ LAN trước khi lớp xác thực LAN được triển khai.

## Biến origin

Local:

```text
HEALTH_CARE_LOCAL_BASE_URL=http://127.0.0.1:3001
RU_LIFE_LOCAL_BASE_URL=http://127.0.0.1:3002
BAUMAN_CONTROL_LOCAL_BASE_URL=http://127.0.0.1:3003
BOI_ECH_LOCAL_BASE_URL=http://127.0.0.1:3004
BAUMAN_APP_LOCAL_ORIGIN=http://127.0.0.1:3005
```

Production tương ứng dùng HTTPS. Riêng Bauman phải cấu hình hai giá trị độc lập:

```text
BAUMAN_CONTROL_BASE_URL=https://<bauman-control-host>
BAUMAN_APP_ORIGIN=https://<bauman-learning-runtime-host>
```

`BAUMAN_APP_ORIGIN` cũng phải được cấu hình cùng URL runtime ở phía Bauman Control Service để CORS/Device Gate chỉ tin đúng website học tập.

## Chạy toàn hệ thống trên Windows

Từ thư mục `Application-Management`:

```powershell
npm run local:system
```

hoặc nhấp đúp `RUN_LOCAL_SYSTEM.bat`.

Launcher sẽ kiểm tra Node.js và các repo, áp migration vào D1 local, sinh secret liên-app tạm thời, khởi động Health/RU/Bauman Control/Bơi ếch/Bauman Runtime, chờ các endpoint sẵn sàng rồi mới bật Application Management. `Ctrl+C` dừng toàn bộ.

Secret tạm thời không được ghi vào GitHub. `.dev.vars` chỉ chứa danh tính local development và bị `.gitignore` loại khỏi source control.

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

Resolver thử từng origin local trước. Nếu local không phản hồi trong thời gian probe ngắn, nó chỉ fallback sang origin production HTTPS đã cấu hình. Bauman Control và Bauman Runtime được resolve độc lập; mất runtime học không được làm control-plane trỏ nút Website vào Control Service.

HTTP public không bao giờ được coi là production origin. HTTP chỉ được chấp nhận cho localhost/private network trong local/hybrid.

## Dữ liệu offline

Local runtime sử dụng D1 local trong `.wrangler` của **từng repo**. Vì vậy Health, RU LIFE, Bơi ếch, Bauman Control và Application Management local không đụng database production của nhau hoặc của chính app trên cloud.

Phiên bản này chưa đồng bộ hai chiều local ↔ production và chưa có hàng đợi lệnh offline gửi lên cloud. Không được diễn giải snapshot local là trạng thái production.

## Ranh giới quản trị

```text
Application Management local
        │
        ├── signed Health bridge ──> Health local registry
        ├── opaque RU bridge ──────> RU LIFE local registry
        ├── signed Bơi ếch bridge ─> Bơi ếch local registry
        └── signed Bauman bridge ──> Bauman Control :3003
                                      ↑
Bauman Learning Runtime :3005 ── P-256 Device Gate / BM registry
```

Application Management không đọc/ghi trực tiếp database chuyên môn của client. Bauman sở hữu registry `BM-`, challenge P-256, session/revoke, audit và command ledger. Central chỉ phát lệnh có kiểm chứng và đọc lại trạng thái.

## Bảo mật

Local dev identity chỉ được chấp nhận khi môi trường development, `LOCAL_DEV_AUTH=1` và request tới loopback. Không bật `LOCAL_DEV_AUTH` ở Cloudflare production. Production auth đi qua Cloudflare Access.

LAN mode chưa được bật trong launcher. Khi triển khai LAN phải có auth riêng (Access tunnel/VPN hoặc signed local session), không chỉ đổi host sang `0.0.0.0`.

## Gate trước khi merge/release

Mỗi client phải pass CI riêng. Sau đó Application Management phải pass build + toàn bộ contract/regression tests. Bauman Control v4 và Device Gate đã được triển khai và local E2E đã kiểm chứng; tuy nhiên `contractState` vẫn phải giữ `migrating` cho tới khi **cả** Control Service production và Learning Runtime production được deploy, cấu hình đúng origin/secret và handshake live được xác minh.

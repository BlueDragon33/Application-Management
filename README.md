# Application Management

Application Management là **server/control-plane quản trị** cho các web app/site độc lập. Trung tâm cấp policy, quyền và điều phối; không chạy nội dung học tập, sức khỏe hoặc dữ liệu chuyên môn của client.

## Topology

```text
LEVEL 0 · SERVER
Application Management
├── thiết bị quản trị QT- (P-256)
├── vai trò & phân quyền
├── application registry
├── audit/bảo mật Trung tâm
└── app-scoped admin contracts
    ├── LEVEL 1 · Bơi ếch
    ├── LEVEL 1 · Sức khỏe Y tế
    ├── LEVEL 1 · Hòa nhập Nga
    ├── LEVEL 1 · Bauman Hub
    │   ├── LEVEL 2 · Math_Bauman
    │   └── LEVEL 2 · subject modules
    └── LEVEL 1 · GrowUP MyChildren
```

Chi tiết topology: [`docs/CONTROL_PLANE_TOPOLOGY.md`](docs/CONTROL_PLANE_TOPOLOGY.md).

## Nguyên tắc bắt buộc

Application Management chỉ được:

- quản lý thiết bị quản trị của chính Trung tâm;
- cấp/khóa/thu hồi quyền qua contract của từng client;
- cấp hoặc thu hồi quyền chỉnh sửa khi client có backend tương ứng;
- theo dõi trạng thái vận hành tối thiểu;
- kiểm duyệt thay đổi mà client chủ động gửi lên;
- ghi audit thay đổi quyền/bảo mật.

Application Management không được:

- nhúng runtime client;
- dùng chung database/registry giữa các client;
- dùng bridge Bơi ếch cho client khác;
- đưa dữ liệu sức khỏe/trẻ em riêng tư về control-plane;
- tạo nút thao tác khi backend thật chưa tồn tại.

## Namespace thiết bị

| Phạm vi | Namespace | Ghi chú |
|---|---|---|
| Application Management | `QT-` | Thiết bị quản trị Trung tâm |
| Bơi ếch | `BE-` | Registry Bơi ếch |
| Sức khỏe Y tế | `SK-` | Registry Health_Care |
| Hòa nhập Nga | `HN-` | Registry + session thuộc RU_LIFE |
| Bauman | `BM-` | Contract yêu cầu, backend chưa triển khai |
| GrowUP | `GU-` | Contract yêu cầu, backend chưa triển khai |

Quyền **truy cập** và quyền **chỉnh sửa** luôn là hai lớp độc lập.

## Bơi ếch

Khu quản trị nằm riêng tại `app/apps/boi-ech/` và chỉ còn nghiệp vụ Bơi ếch. Các phần legacy đã bị xóa:

- `app/control-center.tsx`;
- `app/boi-admin-boundary.module.css`;
- `/api/content` shim cũ.

`/api/dashboard` chỉ bootstrap bridge Bơi ếch ngắn hạn. Central device/role/audit chỉ thuộc `/api/center`.

## Sức khỏe Y tế

`Health_Care` sở hữu runtime, Device Gate, registry `SK-`, dữ liệu và Control API. Application Management đã có adapter thật cho:

- device access;
- policy;
- sessions;
- content review;
- app audit.

Adapter dùng `HEALTH_CONTROL_SERVICE_SECRET` riêng. Hồ sơ sức khỏe cá nhân không đi vào Application Management.

Trạng thái vẫn là `migrating` cho tới khi xác minh secret/origin/deployment production.

## Hòa nhập Nga

`RU_LIFE` là client độc lập, không có form đăng nhập trực tiếp. `main` hiện sở hữu toàn bộ runtime PWA, D1, registry `HN-`, challenge P-256, session ledger và audit HN.

Luồng quản trị hiện tại:

1. thiết bị người dùng đăng ký/challenge/authorize **same-origin trong RU_LIFE**;
2. RU_LIFE server tự phân loại computer/phone/tablet-iPad và lưu registry `HN-`;
3. Application Management xác thực thiết bị quản trị `QT-` rồi phát vé bridge HMAC 5 phút;
4. UI quản trị gọi `/api/control/devices`, `/sessions`, `/audit` của RU_LIFE bằng vé đó;
5. RU_LIFE tự ghi thay đổi access/edit/session/audit vào D1 của chính client.

Application Management không còn route runtime cho đăng ký HN, không phát session người dùng HN và không đọc/ghi bảng `ru_life_*` trong request path. Migration `drizzle/0002_ru_life_device_gateway.sql` được giữ lại **chỉ như lịch sử legacy** để tránh drop dữ liệu chưa xác minh; không được dùng làm nguồn state mới.

RU_LIFE standalone CI và Application Management bridge CI đã xanh. Trạng thái vẫn là `migrating` cho tới khi xác minh `RU_LIFE_BASE_URL`, secret dùng chung và D1 production thật.

## Bauman Hub

Bauman là client cha cấp 1, không phải một nút mở site học tập. Khu quản trị riêng hiển thị topology sub-client và readiness contract.

Repo Bauman có:

- `CONTROL_INTEGRATION.md`;
- `control/application-management.contract.json`.

Math_Bauman là repo độc lập; các subject còn lại vẫn nằm dưới Bauman Hub. Device registry `BM-`, admin API, audit API và content-review API hiện chưa có backend thật nên không có thao tác giả trong Application Management.

## GrowUP MyChildren

GrowUP đã có runtime/PWA local-first. Khu quản trị Application Management tập trung vào privacy boundary và readiness.

Repo GrowUP có:

- `docs/CONTROL_INTEGRATION.md`;
- `control/application-management.contract.json`.

Control-plane tuyệt đối không nhận hồ sơ trẻ, health/nutrition records, private notes, portfolio evidence hoặc nội dung backup. Registry `GU-`, admin API và remote audit/config-review API chưa có backend nên chưa bật thao tác từ xa.

## Trạng thái hiện tại

| Client | Runtime | Admin code | Production contract |
|---|---|---|---|
| Bơi ếch | Có | Connected | Connected |
| Health_Care | Có | Adapter + UI thật | Migrating |
| RU_LIFE | Có + D1 riêng | Signed bridge + Control API | Migrating |
| Bauman Hub | Có | Management readiness | Pending backend |
| GrowUP | Có | Privacy/readiness management | Pending backend |

Không đổi `migrating/pending` thành `connected` chỉ vì code build xanh; phải có bằng chứng deployment/configuration thật.

## Bảo mật Trung tâm

Thiết bị quản trị dùng P-256 + challenge một lần. Vai trò:

- `viewer`
- `reviewer`
- `publisher`
- `owner`

Các thay đổi central role/device được ghi vào `control_audit_log`. Owner/self-device được bảo vệ khỏi thao tác tự hủy.

## Development gate

- Node.js `>=22.13.0`
- `npm run install:ci`
- `npm run build`
- `npm test`
- `npm run lint`

Source chính nằm trong `app/`; D1 schema/migrations nằm trong `db/` và `drizzle/`.

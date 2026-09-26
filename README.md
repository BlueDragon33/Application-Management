# Application Management

Application Management là **server/control-plane quản trị** cho các web app/site độc lập. Trung tâm cấp policy, quyền và điều phối; không chạy nội dung học tập, sức khỏe hoặc dữ liệu chuyên môn của client.

## Topology

```text
LEVEL 0 · SERVER
Application Management · ChatGPT Site
├── thiết bị quản trị QT- (P-256)
├── vai trò & phân quyền
├── application registry
├── audit/bảo mật Trung tâm
└── app-scoped admin contracts
    ├── LEVEL 1 · Software Blueprint Hub · Core Engineering Compass (metadata-only)
    ├── LEVEL 1 · Bơi ếch
    ├── LEVEL 1 · Sức khỏe Y tế
    ├── LEVEL 1 · Hòa nhập Nga
    ├── LEVEL 1 · Bauman Hub
    │   ├── LEVEL 2 · Math_Bauman
    │   └── LEVEL 2 · subject modules
    ├── LEVEL 1 · GrowUP MyChildren
    ├── LEVEL 1 · PriceReport Tùng Gia Bảo
    └── LEVEL 1 · CAD CAM 3D
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
| Bauman | `BM-` | Registry, P-256 Device Gate, session/revoke, audit và device commands đã có backend |
| GrowUP | `GU-` | Local Control Service privacy-safe đã có; production remote vẫn fail-closed |
| PriceReport | `KT-` | Registry/Device Control local-first, tách dữ liệu báo giá khỏi control-plane |
| CAD CAM 3D | `CAD-` | Namespace dành riêng; remote registry/control chưa bật |

Quyền **truy cập** và quyền **chỉnh sửa** luôn là hai lớp độc lập.

## Software Blueprint Hub — Core Engineering Compass

`Software-Blueprint-Hub` là app dẫn lối kiến trúc cho toàn hệ sinh thái, được xây theo mô hình **20 tầng**. Application Management chỉ hiển thị trạng thái xây dựng, readiness và boundary metadata; không được sửa Constitution/Blueprint canonical state, không PASS Quality Gate và không authorize Production release.

Trạng thái hiện tại: **Phase 8 PASS; Phase 9 Compass Construction; P9-001–P9-003 COMPLETE; P9-004 Source-of-truth contradiction detector ACTIVE**. Khu quản trị riêng: `/apps/software-blueprint-hub`.

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

Application Management hiện chạy trong **ChatGPT Sites**. Kết nối Health không được hard-code qua `workers.dev`; bridge lấy URL Site Health từ `HEALTH_CARE_BASE_URL` và dùng khóa riêng `HEALTH_CONTROL_SERVICE_SECRET` trong môi trường hosting của Sites.

Vé bridge chuẩn có tuổi thọ 5 phút và danh tính:

- issuer: `application-management`;
- audience: `health-care-control`;
- app: `health-care`.

Health_Care chỉ dùng khóa này để xác minh control-plane; khóa không phải cơ chế đăng nhập người dùng và không được lưu trong repo hoặc `.openai/hosting.json`. Hồ sơ sức khỏe cá nhân không đi vào Application Management.

Trạng thái vẫn là `migrating` cho tới khi URL Site Health và khóa kết nối được cấu hình ở ChatGPT Sites và Control API live được xác minh.

## Hòa nhập Nga

`RU_LIFE` là client độc lập, không có form đăng nhập trực tiếp. `main` hiện sở hữu toàn bộ runtime PWA, D1, registry `HN-`, challenge P-256, session ledger và audit HN.

Luồng quản trị hiện tại:

1. thiết bị người dùng đăng ký/challenge/authorize **same-origin trong RU_LIFE**;
2. RU_LIFE server tự phân loại computer/phone/tablet-iPad và lưu registry `HN-`;
3. Application Management xác thực thiết bị quản trị `QT-` rồi phát vé bridge HMAC 5 phút;
4. UI quản trị gọi `/api/control/devices`, `/sessions`, `/audit` của RU_LIFE bằng vé đó;
5. RU_LIFE tự ghi thay đổi access/edit/session/audit vào D1 của chính client.

Application Management không còn route runtime cho đăng ký HN, không phát session người dùng HN và không đọc/ghi bảng `ru_life_*` trong request path. Migration `drizzle/0002_ru_life_device_gateway.sql` được giữ lại **chỉ như lịch sử legacy** và không nằm trong journal triển khai; không được dùng làm nguồn state mới.

Các migration đã từng được áp dụng cho D1 của Site được giữ nguyên như lịch sử bất biến, kể cả khi bảng legacy không còn được runtime sử dụng. Việc dọn dữ liệu legacy phải là một migration riêng có kiểm kê và phê duyệt, không được thực hiện ngầm trong lần chuyển hosting này.

RU_LIFE standalone CI và Application Management bridge CI đã xanh. Trạng thái vẫn là `migrating` cho tới khi xác minh endpoint, secret dùng chung và D1 production thật.

## Bauman Hub

Bauman là client cha cấp 1, không phải một nút mở site học tập. Khu quản trị riêng hiển thị topology sub-client và readiness contract.

Repo Bauman có:

- `CONTROL_INTEGRATION.md`;
- `control/application-management.contract.json`.

Math_Bauman là repo độc lập; các subject còn lại vẫn nằm dưới Bauman Hub. Device registry `BM-`, P-256 Device Gate, session/revoke, audit và device-command contract đã có backend thật và đã qua local E2E. Application Management chỉ bật Duyệt/Khóa/Mở khóa/Quyền sửa khi capability live xác nhận. Content-review API vẫn chưa có contract riêng nên không có thao tác giả cho phần này.

## GrowUP MyChildren

GrowUP đã có runtime/PWA local-first. Khu quản trị Application Management tập trung vào privacy boundary và readiness.

Repo GrowUP có:

- `docs/CONTROL_INTEGRATION.md`;
- `control/application-management.contract.json`.

Control-plane tuyệt đối không nhận hồ sơ trẻ, health/nutrition records, private notes, portfolio evidence hoặc nội dung backup. GrowUP đã có local Control Service privacy-safe cho registry `GU-`, approve/block, optimistic concurrency, idempotent command và audit metadata. Production remote vẫn giữ fail-closed cho tới khi origin/deployment thật được xác minh.

## PriceReport Tùng Gia Bảo

PriceReport là client kế toán/báo giá local-first. Dữ liệu báo giá, khách hàng, danh mục và backup vẫn thuộc client. Application Management chỉ đọc management contract và metadata thiết bị an toàn qua namespace `KT-`.

KT Control đã có P-256 session, optimistic concurrency, idempotent command và read-back trong local stack. Production remote chỉ được coi là sẵn sàng sau khi origin/secret/deployment thật được xác minh.

## CAD CAM 3D

CAD CAM 3D là client kỹ thuật cấp 1. Trung tâm chỉ quản lý readiness, policy giao diện, feature flags, print-policy và ranh giới thiết bị. Project CAD, geometry, mesh và file STL/STEP/3MF không được đưa vào control-plane.

Remote registry `CAD-`, signed Device Gate và Control API chưa tồn tại nên mọi mutation CAD vẫn bị khóa có chủ đích.

## Trạng thái hiện tại

| Client | Runtime | Admin code | Production contract |
|---|---|---|---|
| Software Blueprint Hub | Compass web-app | Metadata-only lifecycle/readiness | Phase 9 Development · Production not authorized |
| Bơi ếch | Có | Signed bridge + Thanh toán & Quyền | Connected |
| Health_Care | Có | ChatGPT Sites adapter + UI thật | Migrating |
| RU_LIFE | Có + D1 riêng | Signed bridge + Control API | Migrating |
| Bauman Hub | Có | BM registry + Device Contract + admin UI | Migrating |
| GrowUP | Có | Privacy-safe local Control Service | Pending production remote |
| PriceReport | Có | KT Control + device management local-first | Migrating |
| CAD CAM 3D | Có | Readiness/policy admin, mutation fail-closed | Pending Control API |

Không đổi `migrating/pending` thành `connected` chỉ vì code build xanh; phải có bằng chứng deployment/configuration thật.

## Bảo mật Trung tâm

Site dùng **đăng nhập ChatGPT do nền tảng Sites điều phối**. Ứng dụng chỉ đọc các header danh tính đã được Sites xác thực (`oai-authenticated-user-id`, `oai-authenticated-user-email` và tên hiển thị tùy chọn); không duy trì mật khẩu, cookie phiên hoặc OAuth riêng.

Quyền xem Site được áp dụng bởi access policy của ChatGPT Sites. Sau khi xác thực, quyền nghiệp vụ vẫn được kiểm tra ở server theo thiết bị quản trị và vai trò trong D1.

Thiết bị quản trị dùng P-256 + challenge một lần. Vai trò:

- `viewer`
- `reviewer`
- `publisher`
- `owner`

Các thay đổi central role/device được ghi vào `control_audit_log`. Owner/self-device được bảo vệ khỏi thao tác tự hủy.

## Cấu hình hosting ChatGPT Sites

`Application-Management/.openai/hosting.json` chỉ lưu project linkage và tên binding. Giá trị runtime/secret không được commit.

Các bridge production chỉ được cấu hình trong phần Settings của Site Application Management, không commit vào Git. Tối thiểu gồm các origin/secret tương ứng với client thực sự đã publish, ví dụ `HEALTH_CARE_BASE_URL` + `HEALTH_CONTROL_SERVICE_SECRET`, `RU_LIFE_BASE_URL` + `RU_LIFE_CONTROL_SERVICE_SECRET`, `BAUMAN_CONTROL_BASE_URL` + `BAUMAN_CONTROL_SERVICE_SECRET`, và bridge Bơi ếch khi được bật.

Sau khi đổi environment/secret phải phát hành lại bản Site được duyệt. PriceReport/GrowUP/CAD chỉ được nối production khi contract và origin tương ứng đã được xác minh; không dùng URL giả để ép trạng thái connected. Cloudflare Worker hiện là track preview độc lập, không thay thế việc publish ChatGPT Site production trong cấu hình hiện tại.

## Development gate

- Node.js `>=22.13.0`
- `npm run install:ci`
- `npm run build`
- `npm test`
- `npm run lint`

Source chính nằm trong `app/`; D1 schema/migrations nằm trong `db/` và `drizzle/`.

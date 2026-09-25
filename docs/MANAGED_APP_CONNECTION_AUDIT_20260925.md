# Managed App Connection Audit · 2026-09-25

## Mục tiêu

Chuẩn hóa việc kết nối ứng dụng vào Application Management theo nguyên tắc:

1. Dynamic Catalog là đường quản trị chuẩn.
2. Universal Contract hoặc protocol contract tương thích được ưu tiên.
3. Adapter legacy chỉ là fallback tương thích.
4. Không sửa source Application Management khi thêm app mới.
5. Capability không được suy đoán từ tên app/category.
6. Mutation chỉ bật khi contract live công bố đủ guardrail.

## Trạng thái các app hiện có

### Bauman Master AI

- Control Service production và runtime production đã có origin trong Application Management Production.
- Legacy adapter đang hoạt động.
- Bauman Control `/api/control/status` có schema đủ để Dynamic Catalog auto-discover.
- Có thể migrate sang Dynamic Catalog ngay khi thêm catalog entry + credential app-scoped.
- Dynamic path ưu tiên contract live; legacy adapter giữ fallback cho tới khi parity hoàn tất.

### Bơi ếch AI

- Repo có workflow Cloudflare Production.
- Application Management Production hiện không có `BOI_ECH_PRODUCTION_ORIGIN` ở lần deploy live gần nhất.
- Client có `/api/control/status`, nhưng status chưa công bố generic device registry/device-command contract tương đương legacy flow.
- Bơi ếch còn semantics đặc thù Miễn phí/Trả phí; generic approve không được suy đoán.
- Có thể dùng Dynamic Catalog cho discovery/visibility khi origin + credential được cấu hình; mutation vẫn fail-closed nếu capability không đủ.

### Health_Care

- Repo đã có Control API đầy đủ và public `/api/control/contract`.
- Tài liệu hiện có Cloudflare Preview; chưa xác nhận một Production Worker riêng đã được promote.
- Application Management Production hiện không có Health production origin ở lần deploy live gần nhất.
- Dynamic Catalog có thể auto-discover `/api/control/contract` ngay khi có production origin.
- Khi credential có mặt, registry đọc được theo generic path; mutation generic chỉ bật khi contract công bố đủ idempotency/concurrency.

### RU_LIFE

- Repo có Control API `/api/control/status` với device registry, approval, idempotency và optimistic concurrency.
- Tài liệu hiện có Cloudflare Preview; chưa xác nhận Production Worker đã promote.
- Application Management Production hiện không có RU_LIFE production origin ở lần deploy live gần nhất.
- Dynamic Catalog có thể auto-discover status với credential khi production origin tồn tại.

### PriceReport Tùng Gia Bảo

- Public app đang chạy qua GitHub Pages.
- Repo có `public/management-contract.json` và Control Service production template.
- Manifest hiện khai `remoteAdminReady=false`; vì vậy generic mutation phải giữ fail-closed cho tới khi Control Service production read-back xác nhận.
- Dynamic Catalog hỗ trợ manifest tĩnh `/management-contract.json`.

### GrowUP MyChildren

- Repo có `control/application-management.contract.json`.
- Manifest hiện ghi remote device/admin backend chưa đầy đủ.
- Dynamic Catalog có thể đọc manifest tĩnh để hiển thị trạng thái pending/warning mà không cần thêm code trung tâm.
- Không bật remote mutation cho tới khi client triển khai endpoint thật.

### NC03 Modem

- App local-first, credential modem phải ở thiết bị người dùng.
- Không được biến Dynamic Catalog thành proxy credential modem.
- Có thể tham gia Catalog ở mức runtime/web launch/status contract.
- Remote modem command vẫn fail-closed.

### CAD CAM 3D

- Có contract/policy seam nhưng remote Control API chưa hoàn chỉnh.
- Dynamic Catalog dùng category Kỹ thuật để sinh guardrail phù hợp.
- Không bật mutation khi chưa có backend.

## Contract Discovery Layer

Trung tâm thử theo thứ tự:

1. contract path được cấu hình trong Catalog;
2. `/api/control/contract`;
3. `/management-contract.json`;
4. `/control/application-management.contract.json`;
5. `/api/control/status` bằng credential app-scoped nếu có.

Các protocol tương thích được normalize về `application-management.contract/v1`.
Normalization chỉ chuyển schema và endpoint/capability rõ ràng. Không suy quyền từ tên app.

## Dynamic-first / legacy-fallback

Với app legacy:

- Dynamic contract `connected` → dùng Dynamic Contract.
- Dynamic contract tồn tại nhưng chưa đủ → adapter legacy tiếp tục phục vụ nếu adapter sống.
- Adapter legacy chết nhưng Dynamic Catalog có entry → hiển thị đúng trạng thái contract động.
- Cả hai không khả dụng → `unavailable/pending`.

Nhờ đó migration từng app không cần flag-day cutover.

## Credential

Credential app mới:

- nhập trong Catalog;
- không đưa xuống browser;
- mã hóa AES-GCM trước khi lưu D1;
- root encryption key là Worker Secret;
- deploy workflow tự tạo key đúng một lần nếu chưa có;
- lần sau giữ key hiện hữu, không tự rotate.

## Category onboarding

Category chuẩn: Học tập, Y tế, Nga, Học thuật, Gia đình, Kế toán, Kỹ thuật.

Category cung cấp UI/device policy mặc định, guardrail, capability gợi ý và contract starter.
Category không tự bật capability.

## Quy trình thêm app mới không sửa code Trung tâm

1. Mở `Catalog & Contract`.
2. Nhập ID, tên, category, origin, public URL và repository.
3. Có thể bấm `Tạo contract mẫu theo phân loại`.
4. Nếu app đã có protocol tương thích, chỉ cần bấm `Lưu & kiểm tra contract`.
5. Nếu endpoint protected, nhập credential app-scoped.
6. Trung tâm tự probe và normalize.
7. App xuất hiện trong dashboard.
8. Capability nào live thì UI tương ứng mới bật.
9. Không thêm route riêng, env name riêng, allow-list riêng hoặc code dashboard riêng.

## Giới hạn còn đúng chủ đích

Các workflow đặc thù như Bơi ếch Miễn phí/Trả phí, RU_LIFE user binding, modem credential/local command, dữ liệu sức khỏe, dữ liệu trẻ em và dữ liệu báo giá không được ép vào generic mutation nếu contract chưa mô tả semantics tương đương.

Generic không có nghĩa là bỏ guardrail.

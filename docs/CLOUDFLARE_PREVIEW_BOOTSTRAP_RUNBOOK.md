# Cloudflare Preview · Runbook bootstrap toàn hệ thống

## Phạm vi

Tài liệu này là thứ tự vận hành canonical cho preview của hệ thống. `Application-Management` là control-plane trung tâm duy nhất; Health_Care, RU_LIFE, Bơi ếch và Bauman tiếp tục sở hữu runtime/database/registry/audit riêng. GrowUP chỉ được nối khi có preview contract thật; không dùng fallback ChatGPT Sites.

Không bước nào trong runbook này được tự động promote production.

## 1. GitHub Environments

| Repo | Environment | Preview runtime |
| --- | --- | --- |
| `BlueDragon33/Application-Management` | `application-management-preview` | `application-management-preview` |
| `BlueDragon33/Health_Care` | `health-preview` | `health-care-preview` |
| `BlueDragon33/RU_LIFE` | `ru-life-preview` | `ru-life-preview` |
| `BlueDragon33/BOIECH_AI` | `boi-ech-preview` | `boi-ech-preview` |
| `BlueDragon33/Bauman-master-ai-system` | `bauman-preview` | `bauman-control-preview` + `bauman-master-ai-preview` |

Tất cả workflow deploy preview đều là `workflow_dispatch` và yêu cầu nhập chính xác `DEPLOY_PREVIEW`.

## 2. D1 preview phải tách production/local

Tạo D1 preview riêng trước khi deploy:

- Application Management: `application-management-preview-db`;
- Health: `health-care-preview-db`;
- RU_LIFE: `ru-life-preview-db`;
- Bơi ếch: `boi-ech-preview-db`;
- Bauman Control: `bauman-control-preview-db`.

Bơi ếch còn cần R2 riêng `boi-ech-preview-payments`.

Không copy dữ liệu production nhạy cảm vào preview. Chỉ dùng synthetic/test data.

Production D1 guard là **bắt buộc** ở mọi preview Environment. Materializer phải fail-closed nếu guard bị thiếu, sai định dạng hoặc trùng preview D1:

- Application Management: `APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID`;
- Health: `HEALTH_PRODUCTION_D1_DATABASE_ID`;
- RU_LIFE: `RU_LIFE_PRODUCTION_D1_DATABASE_ID`;
- Bơi ếch: `BOI_ECH_PRODUCTION_D1_DATABASE_ID`;
- Bauman: `BAUMAN_CONTROL_PRODUCTION_D1_DATABASE_ID`.

Không chạy migration/deploy thật nếu chưa biết chắc production D1 ID dùng làm guard.

## 3. Secret liên ứng dụng

Mỗi client dùng secret app-scoped riêng. Giá trị ở client preview và Application Management preview phải khớp chính xác:

- Bơi ếch ↔ Application Management: `CONTROL_SERVICE_SECRET`;
- Health ↔ Application Management: `HEALTH_CONTROL_SERVICE_SECRET`;
- RU_LIFE ↔ Application Management: `RU_LIFE_CONTROL_SERVICE_SECRET`;
- Bauman ↔ Application Management: `BAUMAN_CONTROL_SERVICE_SECRET`.

Không dùng một secret chung cho mọi app. Không ghi secret vào Git, PR, issue, log hoặc tài liệu.

## 4. Pha A · dựng Application Management preview độc lập

Trong `application-management-preview`, cấu hình tối thiểu:

Secrets:

- `CLOUDFLARE_API_TOKEN`;
- `CLOUDFLARE_ACCOUNT_ID`;
- `APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID`;
- `APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID`;
- `CF_ACCESS_CLIENT_ID`;
- `CF_ACCESS_CLIENT_SECRET`.

Variables:

- `CONTROL_OWNER_EMAILS`;
- `CF_ACCESS_TEAM_DOMAIN`;
- `CF_ACCESS_AUD`;
- `APPLICATION_MANAGEMENT_PREVIEW_ORIGIN`.

Ở lần deploy đầu, để trống toàn bộ client preview origins chưa tồn tại:

- `BOI_ECH_PREVIEW_ORIGIN`;
- `HEALTH_CARE_PREVIEW_ORIGIN`;
- `RU_LIFE_PREVIEW_ORIGIN`;
- `BAUMAN_CONTROL_PREVIEW_ORIGIN`;
- `BAUMAN_RUNTIME_PREVIEW_ORIGIN`;
- `GROWUP_PREVIEW_ORIGIN`.

Chạy workflow `Application Management Cloudflare Preview Deploy` với `DEPLOY_PREVIEW`.

Gate bắt buộc sau pha A:

1. anonymous request tới `/__deployment` không được HTTP 200;
2. service-token request phải đọc được `/__deployment`;
3. `application=application-management`;
4. `channel=cloudflare-preview`;
5. D1 schema ready;
6. Access configured;
7. owner policy configured;
8. network mode là `production`, không localhost fallback.

Sau deploy, chạy workflow `Application Management Preview Read-only Verification`, chọn `phase-a`, nhập `VERIFY_PREVIEW`. Workflow này chỉ dùng `GET` và không có Cloudflare deploy credentials. Nó phải xác nhận 5 client origins vẫn trống và GrowUP chưa được nối.

Chỉ khi các gate này pass mới dùng `APPLICATION_MANAGEMENT_PREVIEW_ORIGIN` cho client.

## 5. Pha B · dựng từng client preview

### Health_Care

Environment `health-preview`:

Secrets bắt buộc:

- `CLOUDFLARE_API_TOKEN`;
- `CLOUDFLARE_ACCOUNT_ID`;
- `HEALTH_PREVIEW_D1_DATABASE_ID`;
- `HEALTH_PRODUCTION_D1_DATABASE_ID`;
- `HEALTH_CONTROL_SERVICE_SECRET`.

Variables:

- `APPLICATION_MANAGEMENT_PREVIEW_ORIGIN` = origin đã pass pha A;
- `HEALTH_PREVIEW_ORIGIN` có thể để trống ở lần đầu, sau deploy ghi lại URL thật rồi cấu hình cho lần smoke tiếp theo.

Workflow: `Health Cloudflare Preview Deploy`.

Health Control CORS phải tin đúng **một** `APPLICATION_MANAGEMENT_ORIGIN`; không dùng allowlist `*.chatgpt.site`. HTTP chỉ được phép cho loopback khi chạy local với `LOCAL_CONTROL_PLANE=true`.

### RU_LIFE

Environment `ru-life-preview`:

Secrets bắt buộc:

- `CLOUDFLARE_API_TOKEN`;
- `CLOUDFLARE_ACCOUNT_ID`;
- `RU_LIFE_PREVIEW_D1_DATABASE_ID`;
- `RU_LIFE_PRODUCTION_D1_DATABASE_ID`;
- `RU_LIFE_CONTROL_SERVICE_SECRET`.

Variables:

- `APPLICATION_MANAGEMENT_PREVIEW_ORIGIN`;
- `RU_LIFE_PREVIEW_ORIGIN` sau lần deploy đầu.

Workflow: `RU_LIFE Cloudflare Preview Deploy`.

### Bơi ếch

Environment `boi-ech-preview`:

Secrets bắt buộc:

- `CLOUDFLARE_API_TOKEN`;
- `CLOUDFLARE_ACCOUNT_ID`;
- `BOI_ECH_PREVIEW_D1_DATABASE_ID`;
- `BOI_ECH_PRODUCTION_D1_DATABASE_ID`;
- `CONTROL_SERVICE_SECRET`.

Variables:

- `APPLICATION_MANAGEMENT_PREVIEW_ORIGIN`;
- `BOI_ECH_PREVIEW_ORIGIN` sau lần deploy đầu.

Workflow: `Boi Ech Cloudflare Preview Deploy`.

Smoke bắt buộc phải xác minh cả D1 registry và R2 `boi-ech-preview-payments`.

### Bauman

Environment `bauman-preview`:

Secrets bắt buộc:

- `CLOUDFLARE_API_TOKEN`;
- `CLOUDFLARE_ACCOUNT_ID`;
- `BAUMAN_CONTROL_PREVIEW_D1_DATABASE_ID`;
- `BAUMAN_CONTROL_PRODUCTION_D1_DATABASE_ID`;
- `BAUMAN_CONTROL_SERVICE_SECRET`.

Variables bắt buộc:

- `APPLICATION_MANAGEMENT_PREVIEW_ORIGIN`;
- `BAUMAN_CONTROL_PREVIEW_ORIGIN`;
- `BAUMAN_RUNTIME_PREVIEW_ORIGIN`.

Control và Learning Runtime phải là hai HTTPS origin khác nhau. Workflow: `Bauman Cloudflare Preview Deploy`.

Gate Bauman phải pass cả Control Service, registry BM-, idempotent device commands, CORS Device Gate và Learning Runtime metadata.

## 6. Pha C · đóng vòng tại Application Management

Sau khi 4 client preview đã có origin thật, cập nhật Environment `application-management-preview`:

- `HEALTH_CARE_PREVIEW_ORIGIN` = Health preview;
- `RU_LIFE_PREVIEW_ORIGIN` = RU_LIFE preview;
- `BOI_ECH_PREVIEW_ORIGIN` = Bơi ếch preview;
- `BAUMAN_CONTROL_PREVIEW_ORIGIN` = Bauman Control preview;
- `BAUMAN_RUNTIME_PREVIEW_ORIGIN` = Bauman Learning Runtime preview.

Cấu hình các secret app-scoped tương ứng ở Application Management bằng đúng giá trị phía client.

Không đặt `GROWUP_PREVIEW_ORIGIN` cho tới khi GrowUP có preview contract thật và được live-probe.

Redeploy Application Management preview bằng `DEPLOY_PREVIEW`.

Sau redeploy, chạy `Application Management Preview Read-only Verification`, chọn `full-stack`, nhập `VERIFY_PREVIEW`. Không chuyển sang mutation E2E nếu read-only gate chưa pass.

## 7. Gate read-only toàn stack

Workflow `Application Management Preview Read-only Verification` chạy trong Environment `application-management-preview` nhưng chỉ có `contents: read`; không nhận `CLOUDFLARE_API_TOKEN`, account ID hay D1 ID.

Verifier `scripts/verify-cloudflare-preview-stack.mjs` chỉ cho phép hai HTTP methods: `GET` và `OPTIONS`. Nó fail ngay nếu code cố dùng method mutation.

Ở `full-stack`, verifier bắt buộc kiểm:

1. Application Management vẫn bị Cloudflare Access chặn anonymous và service-token đọc được deployment metadata;
2. 5 client flags trung tâm đã bật đúng: Bơi ếch, Health, RU_LIFE, Bauman Control, Bauman Runtime; GrowUP vẫn tắt;
3. không origin nào là `*.chatgpt.site`;
4. root runtime của Bơi ếch, Health, RU_LIFE và Bauman Learning Runtime reachable;
5. CORS preflight của 4 Control API trả đúng exact Application Management origin;
6. app-scoped secret đọc được status của từng client;
7. Bơi ếch D1/R2 preview ready qua status metadata;
8. Health contract giữ health/profile data ngoài control-plane;
9. RU_LIFE ownership vẫn client-owned;
10. Bauman Control D1 + Application Management origin + Learning Runtime origin đều ready, và `learningAccessGate=true`;
11. Bauman Learning Runtime xác nhận Control origin đã được cấu hình.

Unit fixture `tests/cloudflare-preview-stack-verifier.test.mjs` chạy trong CI để khóa hành vi chỉ đọc và fail-closed trước khi workflow được dùng với origin thật.

## 8. Pha D · E2E control-plane mutation

Chỉ thực hiện sau khi gate read-only toàn stack pass. Kiểm tra theo thứ tự, dùng synthetic devices/data:

1. dashboard đọc được source trạng thái thật của từng client;
2. `Website` mở runtime người dùng, không mở khu quản trị;
3. Health: SK- đăng ký → pending → approve → session → block → session revoke;
4. RU_LIFE: HN- pending → bind Họ tên/Mã người dùng → approve → block → read-back;
5. Bauman: BM- pending → approve bằng idempotent command → Learning Runtime Device Gate mở → block/revoke → runtime bị chặn;
6. Bơi ếch: pending → approve; spam removal vẫn là semantics xóa riêng của Bơi ếch, không đánh đồng với block của Health/RU/Bauman;
7. mọi mutation phải read-back từ client sở hữu registry trước khi báo thành công;
8. refresh/focus của Application Management chỉ sync đọc, không tự tạo mutation ngoài policy đã bật rõ ràng;
9. không có health/profile/private data bị sao chép sang control-plane.

## 9. Generated artifact gate

Application Management, Health, RU_LIFE và Bơi ếch dùng Cloudflare Vite generated config. `.wrangler/deploy/config.json` là redirect có `configPath`, không phải source of truth metadata cuối.

Các repo này phải follow `configPath` và kiểm generated Wrangler config thật trước deploy. Không quay lại cách grep D1/Worker/R2 trực tiếp trong redirect file.

Bauman Control/Learning Runtime dùng Wrangler configs riêng và dry-run trực tiếp, nên giữ gate theo contract Bauman hiện hành.

## 10. Điều kiện mới được chuẩn bị production

Không tạo production promotion cho tới khi:

- CI và preview artifact gates của tất cả repo xanh;
- production D1 guard bắt buộc đã cấu hình ở mọi preview Environment;
- các preview D1 migrations pass;
- Access của Application Management chặn anonymous;
- read-only full-stack verifier pass;
- E2E mutation/read-back pass cho 4 client;
- Bauman Control/Runtime origin tách đúng;
- không client nào cần `*.chatgpt.site` fallback;
- rollback path cũ vẫn còn cho tới khi production read-back pass;
- production deployment vẫn manual/guarded ở giai đoạn chuyển đổi.

## 11. Trạng thái hiện tại

Phần mã nguồn đã chuẩn hóa đường preview và generated-artifact validation. Preview materializers được thiết kế fail-closed khi thiếu production D1 guard. Health Control CORS đã được chuẩn hóa sang exact `APPLICATION_MANAGEMENT_ORIGIN`. Read-only verifier đã được thiết kế để xác minh bootstrap/full-stack mà không tạo mutation.

Việc deploy preview thật vẫn phụ thuộc GitHub Environment/Cloudflare credentials/D1 IDs/origins thực tế; các giá trị đó không được suy đoán hoặc commit vào repo.

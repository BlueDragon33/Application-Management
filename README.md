# Application Management

Application Management là **server/control-plane quản trị** cho các web app/site độc lập trong hệ thống. Trung tâm là đầu não cấp policy, quyền và điều phối; không phải nơi chạy nội dung học tập, sức khỏe hay nghiệp vụ chuyên môn của từng client.

## Kiến trúc bắt buộc

```text
LEVEL 0 · SERVER
Application Management
├── thiết bị quản trị Trung tâm (P-256)
├── vai trò & phân quyền
├── application registry
├── audit & bảo mật Trung tâm
└── signed admin contracts
    ├── LEVEL 1 · CLIENT: Bơi ếch
    ├── LEVEL 1 · CLIENT: Sức khỏe Y tế
    ├── LEVEL 1 · CLIENT: Hòa nhập Nga
    ├── LEVEL 1 · CLIENT: Bauman Hub
    │   ├── LEVEL 2 · SUB-CLIENT: Math_Bauman
    │   └── LEVEL 2 · SUB-CLIENT/MODULE: các site môn học khác
    └── LEVEL 1 · CLIENT: GrowUP MyChildren
        └── ENDPOINTS: desktop / tablet-iPad / phone
```

Chi tiết topology và quy ước UI nằm tại [`docs/CONTROL_PLANE_TOPOLOGY.md`](docs/CONTROL_PLANE_TOPOLOGY.md).

## Nguyên tắc server → client

Mỗi client phải hoạt động độc lập. Application Management chỉ được:

- cấp, khóa và thu hồi quyền truy cập qua admin contract;
- cấp hoặc thu hồi quyền chỉnh sửa;
- quản lý **thiết bị quản trị của chính Trung tâm**;
- theo dõi trạng thái vận hành tối thiểu qua API/contract;
- kiểm duyệt các thay đổi mà client chủ động gửi lên;
- ghi audit cho thay đổi quyền và bảo mật control-plane.

Application Management **không được**:

- chứa database chuyên môn của client;
- dùng chung registry thiết bị giữa các site;
- nhúng runtime hoặc router nghiệp vụ của client;
- quản trị xuyên tầng vào sub-client nếu client cha chưa công bố contract;
- dựng nút thao tác khi backend thật chưa tồn tại.

## Một shell quản trị, không lặp tầng

Giao diện quản trị dùng một kiến trúc thống nhất giống khu quản trị Bơi ếch:

- sidebar trái là điều hướng chính;
- phần **Hệ thống** chỉ giữ `Tổng quan`, `Quyền & thiết bị`, `Nhật ký hệ thống`;
- các client cấp 1 được liệt kê trực tiếp trong sidebar và dẫn thẳng tới khu quản trị của chính client;
- topology được gộp vào `Tổng quan`, không duy trì một trang sơ đồ riêng;
- không duy trì thêm trang `Danh mục client` dạng card nếu cùng thông tin đã có trong sidebar/registry;
- mỗi client chỉ có **một đường vào quản trị**; không lặp các nút kiểu `Mở site`, `Cấp quyền Web App`, `Vào quản trị ...` ở nhiều tầng.

Khu quản trị client cũng dùng cùng nguyên tắc shell và chỉ gồm các nhóm chức năng cần thiết: `Tổng quan`, `Thiết bị & quyền`, `Nội dung & chỉnh sửa`, và `Sub-client` khi client thật sự có tầng con.

**Sức khỏe Y tế và Hòa nhập Nga là hai client cấp 1 độc lập.** Hòa nhập Nga không được đặt trong miền Y tế và Y tế không được hiển thị/điều khiển nghiệp vụ của Hòa nhập Nga.

## Bơi ếch đã tách vật lý khỏi control-plane

Khu quản trị Bơi ếch hiện nằm tại:

```text
app/apps/boi-ech/
├── page.tsx
└── boi-ech-control-center.tsx
```

Bơi ếch chỉ quản lý nghiệp vụ của chính client:

- thiết bị học và trạng thái online/offline;
- tiến độ học;
- nhóm miễn phí/trả phí và thời hạn;
- AI của Bơi ếch;
- quyền sửa cục bộ;
- duyệt thay đổi nội dung Bơi ếch;
- xóa/khôi phục thiết bị rác của Bơi ếch theo quyền phù hợp.

Các phần legacy đã bị loại bỏ hoàn toàn:

- `app/control-center.tsx`;
- `app/boi-admin-boundary.module.css`;
- `/api/content` shim cũ.

Không còn dùng CSS để ẩn `Quyền quản trị` hoặc `Nhật ký Trung tâm` trong Bơi ếch. Hai miền này chỉ thuộc Application Management.

Luồng API hiện tại:

```text
/api/center
└── control-plane
    ├── central admin devices
    ├── roles & permissions
    └── central security audit

/api/dashboard
└── Bơi ếch bridge bootstrap only
    ├── verify signed QT device proof
    └── issue short-lived Bơi ếch admin bridge

Bơi ếch client
└── /api/control/* của BOIECH_AI
    ├── overview / device operations
    ├── content review
    ├── AI
    └── payment proof
```

`/api/dashboard` không được sở hữu `control_devices`, `control_members`, central audit hay danh mục các client khác.

## Client lớn và sub-client

Client cấp 1 có thể sở hữu client cấp 2. Trường hợp điển hình là **Bauman Hub**:

- `BlueDragon33/Bauman-master-ai-system` là client cha;
- `BlueDragon33/Math_Bauman` đã là repo môn học độc lập;
- các nhóm `subjects/programming`, `subjects/ai`, `subjects/signal`, `subjects/systems`, `subjects/foundation`, `subjects/research`, `subjects/russian` hiện được mô hình hóa như sub-client/module của Bauman;
- Application Management quản trị Bauman qua contract của Bauman, không biến từng môn học thành client cấp 1 một cách tùy tiện.

## Chuẩn thiết bị của client

Các site dùng cùng logic contract nhưng không dùng chung dữ liệu:

1. client tự sinh/giữ định danh thiết bị;
2. client tự động phân loại `desktop`, `tablet/iPad`, `phone`;
3. client chọn giao diện phù hợp theo lớp thiết bị;
4. gửi yêu cầu truy cập theo policy;
5. quyền truy cập và quyền chỉnh sửa là hai lớp độc lập;
6. client giữ presence/online-offline và audit của chính nó;
7. Trung tâm chỉ đọc/điều khiển qua vé hoặc API quản trị ngắn hạn.

Chuẩn UX mặc định:

- **Desktop `>=1024px`**: dashboard 2–4 cột, sidebar, mật độ cao, chuột + bàn phím.
- **Tablet/iPad `600–1023px`**: 1–2 cột, rail/tab thu gọn, touch-first.
- **Phone `<600px`**: một cột, tác vụ ưu tiên, điều hướng gọn, không phụ thuộc hover.

Đây là chuẩn giao diện, không phải cơ chế fingerprint. Device classification phải diễn ra tại client và chỉ gửi metadata thật sự cần thiết cho quản trị.

## Trạng thái tích hợp hiện tại

- **Bơi ếch**: admin bridge đang hoạt động; khu quản trị đã tách vật lý khỏi control-plane và chỉ còn nghiệp vụ Bơi ếch;
- **Health_Care**: repo độc lập có Device Gate và Control API phía client; adapter của Application Management chưa nối vào `/api/center` mới;
- **RU_LIFE**: boundary và luồng P-256 đã được xác lập; runtime/admin API còn đang hoàn thiện;
- **Bauman Hub**: có source và sub-client, nhưng admin contract chính thức chưa đủ để bật điều khiển;
- **GrowUP MyChildren**: repo đã có, management contract chưa hoàn tất.

## Bảo mật

Thiết bị quản trị dùng khóa P-256 và challenge một lần. Vai trò Trung tâm:

- `viewer`
- `reviewer`
- `publisher`
- `owner`

Các thao tác cấp quyền, khóa thiết bị, thu hồi hoặc xóa tài khoản quản trị được giới hạn theo vai trò và ghi vào `control_audit_log`. Thiết bị/tài khoản owner được bảo vệ khỏi thao tác tự hủy từ giao diện.

Bridge Bơi ếch là bridge chuyên biệt. Client khác không được phép dùng `/api/dashboard` làm đường tắt; mỗi client phải có adapter/API quản trị riêng trước khi bật thao tác thật.

## Development

- Node.js `>=22.13.0`
- `npm run install:ci`
- `npm run build`
- `npm test`
- `npm run lint`

Source chính nằm trong `app/`. D1 schema/migrations nằm trong `db/` và `drizzle/`.

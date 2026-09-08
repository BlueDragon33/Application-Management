# Control-plane topology

## Mô hình chuẩn

```text
LEVEL 0 — SERVER / CONTROL PLANE
Application Management
│
├── policy & role
├── thiết bị quản trị Trung tâm
├── audit bảo mật Trung tâm
├── application registry
└── signed admin contracts
    │
    ├── LEVEL 1 — CLIENT: Bơi ếch
    │   └── ENDPOINTS: desktop / tablet-iPad / phone
    │
    ├── LEVEL 1 — CLIENT: Sức khỏe Y tế
    │   └── ENDPOINTS: desktop / tablet-iPad / phone
    │
    ├── LEVEL 1 — CLIENT: Hòa nhập Nga
    │   └── ENDPOINTS: desktop / tablet-iPad / phone
    │
    ├── LEVEL 1 — CLIENT: Bauman Hub
    │   ├── LEVEL 2 — SUB-CLIENT: Math_Bauman (repo độc lập)
    │   ├── LEVEL 2 — SUB-CLIENT/MODULE: programming
    │   ├── LEVEL 2 — SUB-CLIENT/MODULE: ai
    │   ├── LEVEL 2 — SUB-CLIENT/MODULE: signal
    │   ├── LEVEL 2 — SUB-CLIENT/MODULE: systems
    │   ├── LEVEL 2 — SUB-CLIENT/MODULE: foundation
    │   ├── LEVEL 2 — SUB-CLIENT/MODULE: research
    │   └── LEVEL 2 — SUB-CLIENT/MODULE: russian
    │       └── ENDPOINTS do Bauman/sub-client sở hữu
    │
    └── LEVEL 1 — CLIENT: GrowUP MyChildren
        └── ENDPOINTS: desktop / tablet-iPad / phone
```

## Quy tắc phân tầng

1. **Application Management là server quản trị.** Nó không phải nơi chạy nội dung, runtime, session người dùng hoặc database chuyên môn của client.
2. **Client cấp 1 tự sở hữu runtime, DB, device registry và audit nghiệp vụ.** Server chỉ gọi admin contract đã được client công bố.
3. **Client lớn có thể có sub-client.** Ví dụ Bauman Hub quản trị site/module môn học. Application Management không được mặc định xuyên qua Bauman để điều khiển trực tiếp sub-client nếu contract client cha chưa cho phép.
4. **Thiết bị người dùng nằm dưới client.** Danh sách thiết bị trong khu `Thiết bị quản trị` của Application Management chỉ là máy của quản trị viên control-plane.
5. **Không dùng chung registry thiết bị.** Bơi ếch, Health_Care, RU_LIFE, Bauman và GrowUP phải giữ registry riêng; sub-client độc lập cũng phải có ownership rõ ràng.
6. **Không có nút giả.** Nếu admin API, auth, policy hoặc audit chưa tồn tại, UI chỉ được hiển thị trạng thái tích hợp và yêu cầu contract.

## Chuẩn phân loại endpoint

Mỗi client phải tự phân loại endpoint tối thiểu thành ba lớp:

| Lớp | Viewport tham chiếu | Giao diện | Điều hướng | Tương tác |
| --- | --- | --- | --- | --- |
| Desktop | `>= 1024px` | Dashboard 2–4 cột, mật độ cao | Sidebar cố định/thu gọn | Chuột + bàn phím |
| Tablet / iPad | `600–1023px` | 1–2 cột linh hoạt | Rail thu gọn / tab | Touch-first, target >= 44px |
| Phone | `< 600px` | Một cột, ưu tiên tác vụ | Điều hướng gọn/bottom nav khi phù hợp | Touch-first, không phụ thuộc hover |

Các mốc viewport là chuẩn UX mặc định, không phải device fingerprint. Client có thể kết hợp viewport, user-agent hints và capability detection nhưng phải giữ logic cục bộ và tránh gửi dữ liệu nhận diện không cần thiết lên Trung tâm.

## Trạng thái hiện tại

- **Bơi ếch**: admin bridge đã hoạt động.
- **Health_Care**: repo độc lập đã có Device Gate và Control API; adapter chính thức của Application Management vẫn cần nối vào control-plane mới.
- **RU_LIFE**: boundary và luồng P-256 theo thiết bị đã được xác lập; runtime/admin API còn cần hoàn thiện.
- **Bauman Hub**: có cây `subjects/*`; `Math_Bauman` đã là repo độc lập. Admin contract cho Bauman/sub-client chưa hoàn chỉnh.
- **GrowUP MyChildren**: repo độc lập đã tồn tại; management contract chưa đủ để bật thao tác thật.

## Quy ước giao diện quản trị

- Root Application Management phải thể hiện rõ badge `SERVER / CONTROL PLANE`.
- Mọi khu quản trị client phải có breadcrumb `Server / Client / <tên client>`.
- Client có sub-client phải hiển thị tầng `LEVEL 2` riêng, không trộn với client cấp 1.
- Mọi trang liên quan thiết bị phải nói rõ đó là **control-plane admin device** hay **client endpoint**.
- UI phải thay đổi cấu trúc theo desktop/tablet/phone, không chỉ co scale giao diện desktop.

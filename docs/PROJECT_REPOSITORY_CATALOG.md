# Danh mục dự án GitHub

Nguồn chuẩn để đối chiếu các repo thuộc tài khoản `BlueDragon33` với Trung tâm **Quản trị Ứng dụng**.

## Repo hiện hữu

| Repo | Vai trò | Trạng thái quản lý |
| --- | --- | --- |
| `BlueDragon33/Application-Management` | Control-plane trung tâm | Quản trị lõi |
| `BlueDragon33/Bauman-master-ai-system` | Bauman Hub | Có khu quản trị |
| `BlueDragon33/Math_Bauman` | Site Toán Bauman | Theo dõi repo / liên kết Bauman |
| `BlueDragon33/BOIECH_AI` | Bơi ếch AI | Có khu quản trị |
| `BlueDragon33/Health_Care` | Sức khỏe Y tế | Có khu quản trị |
| `BlueDragon33/RU_LIFE` | Hòa nhập Nga | Có khu quản trị |
| `BlueDragon33/GrowUP_MyChildren` | GrowUP MyChildren | Có khu quản trị |
| `BlueDragon33/PriceReport_Tunggiabao` | Báo giá / kế toán | Có khu quản trị |
| `BlueDragon33/NC03_Modem` | NC03 Control Center / modem 5G | Phase 1 v0.3.0 verified artifact · fail-closed · chờ HAR thật |
| `BlueDragon33/ROS-1-2` | Robot / ROS / LiDAR | Theo dõi dự án kỹ thuật |
| `BlueDragon33/Hardware_Simulation` | Virtual Hardware Lab | Theo dõi dự án kỹ thuật |
| `BlueDragon33/MPC_PID_System` | Control Research Workbench | Theo dõi dự án kỹ thuật |
| `BlueDragon33/CAD_CAM_3D` | CAD/CAM cho chi tiết in 3D | Có khu quản trị fail-closed |

Tổng: **13 repo hiện hữu**.

## Source cũ / module đã xác minh vẫn còn

Không xem một tên cũ là “mất source” chỉ vì nó không còn là repo độc lập. Các vị trí dưới đây đã được đối chiếu trực tiếp trên GitHub:

### BOIECH_AI

- `quan-ly-hoc-tap/` — còn nguyên dưới repo `BlueDragon33/BOIECH_AI`, gồm app, database, Drizzle, README và cấu hình build. Đây là source legacy/module thực, không cần tạo một repo `Learning-Management` rỗng để thay thế.
- `boi-ech/` — source ứng dụng Bơi ếch hiện nằm cùng repo cha.

### Bauman-master-ai-system

Repo Bauman hiện chứa cây môn học thực ở `subjects/`:

- `subjects/ai`
- `subjects/foundation`
- `subjects/math`
- `subjects/programming`
- `subjects/research`
- `subjects/russian`
- `subjects/shared`
- `subjects/signal`
- `subjects/systems`

Trong đó `Math_Bauman` vẫn tồn tại như repo site Toán độc lập; `subjects/math` trong Hub phải được coi là phần tích hợp/điểm nối của Hub, không tự động thay thế repo độc lập.

## Tên legacy / dấu vết cũ

Các tên dưới đây từng xuất hiện trong lịch sử thiết kế hoặc cấu trúc dự án nhưng hiện **không tồn tại dưới dạng repo độc lập** trong danh sách GitHub của tài khoản:

- `Learning-Management` / `learning-management` — tên legacy; source liên quan đã xác minh còn ở `BlueDragon33/BOIECH_AI/quan-ly-hoc-tap` và control-plane hiện tập trung ở `Application-Management`.
- `Russian_Bauman_Elearning` — tên legacy; source môn Tiếng Nga hiện đã xác minh có ở `BlueDragon33/Bauman-master-ai-system/subjects/russian`.
- `Math_Bauman_Elearning` — tên legacy; repo Toán hiện hữu đang được quản lý bằng `BlueDragon33/Math_Bauman`, đồng thời Bauman Hub có `subjects/math` làm phần tích hợp nội bộ.

Nguyên tắc: **không tạo repo rỗng chỉ để khớp tên cũ**. Khi tìm được source độc lập thực sự, mới phục hồi repo hoặc import có kiểm soát.

## Cơ chế chống thất lạc repo

- Trang `/projects` có nút **Kiểm tra GitHub** để đối chiếu registry với danh sách repo công khai hiện tại.
- Repo GitHub mới nhưng chưa có trong `app/project-registry.ts` được hiển thị là **chưa đưa vào quản lý**.
- Repo đã đăng ký nhưng không còn thấy công khai chỉ được cảnh báo; hệ thống không tự xóa vì repo có thể đã chuyển private, đổi tên hoặc chuyển chủ sở hữu.
- Workflow `Project Repository Watch` chạy mỗi ngày lúc 09:00 giờ Việt Nam và có thể chạy thủ công. Workflow sẽ fail nếu xuất hiện repo công khai mới chưa được đăng ký.

## Quy tắc thêm dự án mới

1. Repo mới phải được thêm vào `app/project-registry.ts`.
2. Nếu repo có Control API/Device contract thật, mới nối vào khu **Ứng dụng vận hành**.
3. Repo R&D chưa có backend quản trị vẫn phải xuất hiện trong **Dự án GitHub**, nhưng không dựng nút Duyệt/Khóa/Thiết bị giả.
4. Không xóa repo prototype chỉ vì giao diện/chức năng chưa hoàn thiện; dùng trạng thái `prototype` hoặc `scaffold`.
5. Mọi repo phải có README tối thiểu mô tả mục tiêu, phạm vi và quan hệ với hệ thống chung.
6. Tên legacy phải trỏ về source thực đã xác minh nếu source đã được nhập vào repo cha; không tạo bản sao chỉ để giữ tên.

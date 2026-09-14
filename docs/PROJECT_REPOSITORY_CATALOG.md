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
| `BlueDragon33/ROS-1-2` | Robot / ROS / LiDAR | Theo dõi dự án kỹ thuật |
| `BlueDragon33/Hardware_Simulation` | Virtual Hardware Lab | Theo dõi dự án kỹ thuật |
| `BlueDragon33/MPC_PID_System` | Control Research Workbench | Theo dõi dự án kỹ thuật |
| `BlueDragon33/CAD_CAM_3D` | CAD/CAM cho chi tiết in 3D | Theo dõi dự án kỹ thuật |

Tổng: **11 repo hiện hữu**.

## Tên legacy / dấu vết cũ

Các tên dưới đây từng xuất hiện trong lịch sử thiết kế hoặc cấu trúc dự án nhưng hiện **không tồn tại dưới dạng repo độc lập** trong danh sách GitHub của tài khoản:

- `Learning-Management` / `learning-management` — giữ như tên legacy để đối chiếu lịch sử; quản trị hiện tập trung ở `Application-Management`.
- `Russian_Bauman_Elearning` — giữ như tham chiếu legacy cho mảng Tiếng Nga/Bauman; không tạo repo rỗng mới khi chưa xác định source độc lập.
- `Math_Bauman_Elearning` — giữ như tham chiếu legacy; repo Toán hiện hữu đang được quản lý bằng `Math_Bauman`.

Nguyên tắc: **không tạo repo rỗng chỉ để khớp tên cũ**. Khi tìm được source độc lập thực sự, mới phục hồi repo hoặc import có kiểm soát.

## Quy tắc thêm dự án mới

1. Repo mới phải được thêm vào `app/project-registry.ts`.
2. Nếu repo có Control API/Device contract thật, mới nối vào khu **Ứng dụng vận hành**.
3. Repo R&D chưa có backend quản trị vẫn phải xuất hiện trong **Dự án GitHub**, nhưng không dựng nút Duyệt/Khóa/Thiết bị giả.
4. Không xóa repo prototype chỉ vì giao diện/chức năng chưa hoàn thiện; dùng trạng thái `prototype` hoặc `scaffold`.
5. Mọi repo phải có README tối thiểu mô tả mục tiêu, phạm vi và quan hệ với hệ thống chung.

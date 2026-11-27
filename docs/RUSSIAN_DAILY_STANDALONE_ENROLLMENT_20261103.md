# Russian Display-Master · Đăng ký trong App-Manager

Status: **SOURCE-ONLY / PENDING / NOT HOSTED / NOT DEPLOYED**.

- Child application id: `russian-daily`.
- Standalone source: `BlueDragon33/Bauman-Russian-iOS` / `web/russian-daily-standalone`, [candidate 249b310](https://github.com/BlueDragon33/Bauman-Russian-iOS/commit/249b310ff8f6e3363b81ebd1490ccdefc65f49d7).
- Planned cloud host: ChatGPT Sites, **not yet provisioned**; no `publicUrl` until real HTTPS readback.
- New Application-Management catalog/management route: `/apps/russian-daily` (source candidate only), while existing legacy `/tools/russian-daily` and `/russian-daily/` continue untouched until a reviewed transition.
- Do not infer SSO/control API from the catalog entry. `status=planned`, `contractState=pending`.
- User data cannot be transparently copied across origins. Require backup on the old app, confirmation and restore on the new Site, then verify Safari.
- After a genuine ChatGPT Site URL exists, change only this registry's `publicUrl` once in an independently reviewed source PR. Later Russian Daily app releases belong to its standalone host, not App-Management.
- For native iOS/WidgetKit: continue separate P0/B4/RU03 and device QA gates; web PWA does not satisfy them.
- No GitHub Actions, server, database, release, merge, approval, credential, or Site was created by this candidate.

## Kiểm tra bản ứng viên ngày 27/11/2026

- Mục quản lý dùng ID và đường dẫn đã có là `russian-daily` và `/apps/russian-daily`. Tên hiển thị là Russian Display-Master.
- Bản web tại commit `249b310` đạt 117/117 kiểm thử Node và 10/10 tình huống Chrome trên Windows. Đã kiểm tra gói Wi-Fi trên Windows. Safari trên iPhone và Chrome trên Honor đang chờ thử trên thiết bị.
- Nút mở đọc `publicUrl` từ danh mục. Điền địa chỉ sau khi xác minh bản HTTPS của đúng ứng dụng và hoàn tất cổng phát hành. Sau khi cập nhật App-Manager, mở mục quản lý trên site hiện có và kiểm tra nút dẫn tới cùng địa chỉ.
- Bản phát hành dự kiến giữ dữ liệu học trên thiết bị. Bản cập nhật nội dung của ứng dụng tiếp tục đi qua website riêng.

## Chia sẻ công khai và quyền thiết bị

- Link gửi người học là địa chỉ HTTPS chính thức của Russian Display-Master. Trang công khai mở được khi người học chưa đăng nhập App-Manager. Nút mở và nút sao chép đọc cùng một địa chỉ đã xác minh từ danh mục.
- Chủ hệ thống dùng App-Manager để duyệt, khóa và mở lại quyền học của thiết bị đã đăng ký. Quyền này cần hợp đồng và Device Gate thật của Russian Display-Master, được kiểm tra trên máy chủ. Tiến độ tiếp tục do ứng dụng lưu trên thiết bị.
- Kiểm tra trước khi phát hành quản lý thiết bị gồm mở link với khách, đăng ký hai thiết bị riêng, duyệt một thiết bị, khóa và mở lại quyền, kiểm tra từ Safari và Chrome. Kiểm tra việc khóa sau khi thiết bị offline kết nối lại. Thời hạn truy cập offline phải được xác định trong chính sách Device Gate.
- Trạng thái hiện tại chờ địa chỉ phát hành và kết nối Device Gate. Các thao tác thiết bị còn chờ xác minh đầu cuối.

## Source-selection reconciliation (2026-11-03)
- Use the dedicated `candidate/russian-daily-standalone-sites-pwa-20261103-v2` with complete PWA source, including Pair/Contrast and separate images. The earlier `candidate/russian-daily-standalone-chatgpt-sites-20261103` is an alternative isolated source candidate, not a second application registry entry or independent deployment.
- Keep one `russian-daily` application ID, `planned/pending`, no publicUrl. The existing `/tools/russian-daily` remains unmodified and local browser data is never silently moved.
- The standalone v2 currently provides 5 illustrative contrast pairs and local schedule/backup; full ICS/Telegram behavior from the legacy app is NOT parity-certified. Do not retire or redirect legacy until separate functional migration QA passes.

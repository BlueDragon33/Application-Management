# Single Sign-On từ Application Management — ranh giới triển khai

**Yêu cầu sản phẩm:** Người dùng đã được xác thực và cấp quyền tại App-Manage chọn một ứng dụng sẽ được chuyển vào đúng phiên của ứng dụng đó, không cần đăng nhập lặp lại trong trường hợp phiên App-Manage còn hợp lệ và ứng dụng hỗ trợ kết nối SSO.

**Đây là một hợp đồng bắt buộc cho tích hợp trong tương lai, KHÔNG phải tuyên bố SSO đang chạy.** Đến thời điểm sửa liên kết Preview, Application Management và Blueprint OS đang dùng **hai hệ thống phiên độc lập**. Vé control-plane nội bộ dành cho lệnh quản trị **không phải** phiên đăng nhập trình duyệt; không được đưa chúng vào query URL hay dùng để giả phiên đăng nhập. Riêng Health có `managedWebLaunch` theo contract thật; không mặc định tất cả client đã có khả năng đó.

## Giao thức mục tiêu

1. Trên App-Manage, phiên đăng nhập đã xác minh và Device Gate/role được kiểm tra thật. Chỉ sau khi kiểm tra đó, người dùng nhấn **Mở ứng dụng**.
2. App-Manage xin **authorization code dùng một lần**, TTL tối đa 60 giây, dành riêng cho `client_id`, `redirect_uri` HTTPS đăng ký chính xác, actor, device, scope truy cập, state/PKCE. Lưu mã đã tiêu thụ chống replay; không tạo wildcard redirect hoặc token có phạm vi tất cả ứng dụng.
3. Ứng dụng con đổi code qua kênh máy chủ được xác thực (OIDC Authorization Code + PKCE là hướng ưu tiên), xác minh `issuer`, `audience`, chữ ký, `exp`, `nonce`, device/role và trạng thái thu hồi. Không nhận danh tính từ query/cookie/HTTP header do trình duyệt tự tạo.
4. Client phát **cookie phiên HttpOnly Secure SameSite** trên đúng domain của nó, theo quyền/role được ánh xạ từ App-Manage. Không sao chép cookie xuyên domain và không cho App-Manage ghi trực tiếp DB chuyên môn của client. Chức năng nâng quyền, sửa/xóa dữ liệu hoặc Production release tiếp tục cần gate riêng.
5. Client thiếu hoặc lỗi SSO phải hiển thị **“Chưa kết nối đăng nhập một lần”** và giữ cơ chế đăng nhập hợp lệ của chính client; không âm thầm bỏ qua bảo mật. Đóng quyền tại App-Manage phải có cơ chế thu hồi/TTL ngắn ở client.

## Trạng thái hiện tại (không fake compliance)

- **Đã sửa:** App-Manage có đường mở **Preview Blueprint mới** rõ ràng, tách với liên kết Production cũ. Việc click icon Blueprint trong dashboard ưu tiên Preview mới sau khi code được triển khai, không đồng nghĩa cấp phiên đăng nhập.
- **Chưa có:** Issuer OIDC/authorization-code đáng tin cậy ở App-Manage cho mọi client; SSO consumer, ánh xạ principal với quyền dự án và phiên mới tại Blueprint OS; trình duyệt end-to-end và xác minh thu hồi.
- **Không được làm:** Gắn chung `AUTH_SECRET` giữa các app, dùng master password, bỏ `requireChatGPTUser`/`resolveWebActor`, chấp nhận header `oai-authenticated-*` từ Internet, tự ghi `SYSTEM_OWNER` vào database, tự đánh dấu thiết bị duyệt, hoặc coi việc mở website là đã đăng nhập.
- **Thứ tự triển khai:** pilot Blueprint Hub → kiểm thử thực tế một phiên vào/ra, hết hạn, quyền thiếu và replay → mở rộng qua capability `browserSso` cho các client thực sự công bố endpoint, không hard-code cho 15 app.

Trung tâm là chìa khóa **điều phối quyền đã được xác minh**, không phải lối vào bỏ qua xác thực của mọi ứng dụng.

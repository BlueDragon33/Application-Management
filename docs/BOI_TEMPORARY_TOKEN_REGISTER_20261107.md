# Sổ token tạm thời Bơi Ếch — cập nhật 08/11/2026

Hai token đã được xác minh và lưu trong Vault mã hóa của App-Management Preview. Production chưa lưu hai replacement này; token cũ chưa thu hồi, token manager/publish không đổi. Giá trị bí mật không nằm trong sổ này, Git hoặc log.

| Mục đích | Tên | ID quản lý | Phạm vi | Hạn Moscow |
|---|---|---|---|---|
| Preview | boiech-preview-work-20261107-r2 | 47fa4ecea071345c9fc29f3b529edb6e | Editor chỉ boi-ech-preview | 07/12/2026 23:59:59 |
| Lifecycle | boiech-preview-lifecycle-20261107-r2 | 8e8d5260df42cf49fd3584da7edce109 | Account API Tokens Write, đúng account hiện hữu | 07/12/2026 23:59:59 |

UTC: 2026-12-07T20:59:59Z, giữ mốc 30 ngày ban đầu từ 07/11. Thời hạn credential khác quyền sử dụng app và thời hạn manager. Đổi hạn thật Dec7→Dec6 rồi khôi phục Dec7 đã được xác minh qua App và Cloudflare; sau reload kết nối còn và hai ô password rỗng. Chưa thực hiện DELETE thật.

[Trang kết nối Preview](https://application-management-preview.boiech-ai.workers.dev/apps/boi-ech/cloudflare-preview) · [Production](https://application-management.boiech-ai.workers.dev/apps/boi-ech/cloudflare-preview) · [PR #378](https://github.com/BlueDragon33/Application-Management/pull/378).

Báo cáo có thẩm quyền hiện tại: [CLOUDFLARE_PREVIEW_HOTFIX_ACCEPTANCE_20261108.md](CLOUDFLARE_PREVIEW_HOTFIX_ACCEPTANCE_20261108.md), metadata tại docs/evidence/boi-30-day-trial-20261107/replacement-token-register.json. Cổng phát hành người có thẩm quyền và nghiệm thu toàn Issue108 vẫn còn mở.

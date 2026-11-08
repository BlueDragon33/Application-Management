# Cloudflare Preview connection/expiry hotfix — 08/11/2026

> Historical pre-release acceptance snapshot. PR378 is now deployed under the exact approved artifact; current state is in [APP_MANAGEMENT_PRODUCTION_HOTFIX_RELEASE_20261108.md](APP_MANAGEMENT_PRODUCTION_HOTFIX_RELEASE_20261108.md). Authenticated Production smoke/Vault cutover still waits for Owner sign-in. The later Google-session/MFA30 package is separate.

Hai token thay thế đã được xác minh và lưu trong Vault mã hóa của **App-Management Preview hiện hữu**. Thao tác đổi ngày hết hạn thật và khôi phục ngày ban đầu đã thành công, có readback độc lập từ Cloudflare. **Production chưa được triển khai; Account-first V2 / Issue #108 chưa được nghiệm thu.** Báo cáo này thay thế các trạng thái cũ “Preview chưa đăng nhập / Vault chưa lưu”.

| Mốc | Giá trị / kết quả |
|---|---|
| PR hotfix tối thiểu | [Application-Management #378](https://github.com/BlueDragon33/Application-Management/pull/378), Draft |
| Source được kiểm thử | `6395367c8ac0fcf27b31f945ee6f97f81dd838e3`; tree `dff30b700608178d42eac4b245f9f855d8e733b1` |
| Candidate local cùng nội dung source/test | `da766abe1cbe266e27a1e0b26baeabb26655da6a` |
| Base đúng Production hiện hữu | `b2e36758d8dab5c953e71b3aa1f36490b55d770f`; đã đọc lại biến revision trên Cloudflare trong phiên 08/11 |
| Nhánh đích PR | `feat/boiech-preview-ui-lifecycle-20261106`, tại base trên; không đưa các thay đổi V2 vào hotfix |
| Preview script sạch | `9fbdcbbd`; chỉ cập nhật metadata revision sau đó thành version `b3f99412` |
| Runtime Preview đọc thật | `/__deployment`: revision `6395367…`, channel `cloudflare-preview`, DB/assets/Owner policy/Preview access ready |
| Full suite tối thiểu | **855/855**, không fail/skip; gồm typecheck và build |
| Focused lifecycle | **22/22** |
| Full source nhánh Owner/V2 | `ab06c4ae2891f1ccbd9806d0fd95645f487e9205`: **863/863**; chưa deploy toàn nhánh |
| Lint hai candidate | 0 lỗi, 25 cảnh báo hiện hữu mỗi nhánh |
| Review độc lập bằng agent | Không có Critical/Important trong delta; source/blob/artifact và kiểm tra phần giây lẻ được đối chiếu độc lập. Không thay thế reviewer người có thẩm quyền |
| GitHub review / hosted Actions | Chưa có review người; 0 run tại source SHA trên. `[skip ci]` giữ zero-spend, không coi check chưa chạy là PASS |

Lỗi thứ nhất là `redirect: "error"` không được workerd hỗ trợ trong Request options, gây TypeError trước khi gửi yêu cầu. Bản sửa dùng `manual`, giữ nguyên chặn response 3xx và không theo redirect mang credential. Lỗi live thứ hai là Cloudflare từ chối `expires_on` có phần `.000Z` trên endpoint token đang dùng. Bản sửa chỉ bỏ đúng phần giây lẻ bằng 0, giữ nguyên thời điểm; `.001/.123/.999` không bị cắt. Đây là vấn đề tương thích endpoint quan sát thực tế, không phải kết luận rằng RFC3339 với `.000Z` sai chuẩn.

PUT bỏ `not_before` khi chưa đặt và chỉ gửi các thuộc tính policy có thể ghi đã được xác minh đúng Worker/account/Editor; giữ tên, điều kiện và ràng buộc thời gian bắt đầu nếu có. Từ chối validation 400/422 có JSON `success:false` và mã số được giữ là từ chối thực sự, tránh báo thành công sai khi ngày cũ trùng ngày yêu cầu. Mất response, lỗi opaque hoặc kết quả mơ hồ vẫn phải đọc lại. Chẩn đoán chỉ gồm HTTP, tối đa ba mã số và năm tên trường cố định; không trả nguyên văn lỗi provider có thể chứa bí mật.

QA trên trình duyệt thật đã xác minh lưu lifecycle rồi Editor; trường mật khẩu được xóa; tải lại trang vẫn còn kết nối. Token thay thế sai bị chặn và không phá kết nối hợp lệ; ngày quá khứ bị chặn; tên thu hồi sai làm nút bị khóa. Thử PUT cùng ngày trước đó được ghi là **không đủ bằng chứng đổi hạn**. Sau sửa cuối, đã lặp lại đổi **07/12 → 06/12** lúc `2026-11-08T02:42Z`: App báo ngày 06/12, Cloudflare dashboard sau reload cũng hiện 06/12. Khôi phục **07/12** lúc `02:43Z`: dashboard hiện 07/12, App sau reload hiện 07/12, hai ô password đều rỗng. Ảnh trong thư mục bằng chứng chụp chính readback này; ảnh cũ chỉ có ô ngày không được dùng làm bằng chứng provider.

| Token | Phạm vi giữ nguyên | Hạn cuối | Vault Preview / Production |
|---|---|---|---|
| `boiech-preview-work-20261107-r2` (`47fa4ecea071345c9fc29f3b529edb6e`) | Individual Workers Editor chỉ `boi-ech-preview` | 07/12/2026 23:59:59 Moscow | Đã lưu / Chưa lưu |
| `boiech-preview-lifecycle-20261107-r2` (`8e8d5260df42cf49fd3584da7edce109`) | Account API Tokens Write, đúng account hiện hữu | 07/12/2026 23:59:59 Moscow | Đã lưu / Chưa lưu |

UTC tương ứng: `2026-12-07T20:59:59Z`. Giữ mốc 30 ngày ban đầu từ 07/11, không tự gia hạn sang 08/12. Thời hạn credential khác quyền sử dụng app và hạn manager. Giá trị bí mật không có trong Git, tài liệu hoặc log. Hai token cũ chưa bị thu hồi; token manager/publish hiện hữu không đổi. Chưa thử DELETE thật nên **không tuyên bố revoke live PASS**.

Preview giữ D1 `application-management-preview-db` (`00f8a685-452f-472c-81c5-4d0b1c4037c9`), compatibility `2026-09-10`, các binding/secret/assets/Owner policy hiện hữu. Không đổi schema, role, scope, slug, URL hoặc gói Free; không tạo Worker/site, dùng Vercel, dispatch Actions hay mua dịch vụ. `BOI_ECH_BASE_URL` vẫn trống; full-stack V2 chưa cấu hình/nghiệm thu. Số liệu smoke của App Preview không chứng minh ngân sách CPU/tải của Bơi Ếch Free.

Rollback hotfix dự kiến khôi phục compiled bundle/metadata trước phát hành, giữ Vault/D1 và không có migration mới. Chưa thực hiện rollback Production, không coi rollback dữ liệu legacy của V2 là PASS. Các probe KDF Bơi Ếch bằng workerd đúng target chỉ kiểm tra tính đúng tại local, chặn toàn bộ outbound; CPU Free vẫn UNVERIFIED.

Đã đọc toàn bộ compiled module Production version `268c3b94` qua editor nhưng không sửa hoặc bấm Deploy. Nó khác baseline Preview ở các UUID do compiler sinh (build ID và draft-mode secret); adapter gốc giống nhau. Artifact Production chuẩn bị giữ nguyên mọi byte ngoài adapter, khớp candidate đã QA sau khi chuẩn hóa các UUID do compiler sinh; giá trị Production, gồm draft-mode secret, đều được giữ nguyên. SHA-256 LF của baseline Production: `aaeacd9f1b88351ed4a4a5c7e37365d0cb4ddc42231cc56c8f76efb07510c085`; candidate: `46d56833e71a130d9733d399bb91ba8c21a2331d76dc9b569e05c6fcb9becb48`. Cả hai đã parse JavaScript thành công. `production-release-plan.json` và `compiled-adapter.patch` ghi chính delta dự kiến; đây là chuẩn bị, chưa phải quyền phát hành.

Lưu ý độ chính xác hash: file capture cũ thêm một LF cuối file có hash `5c4f10a…`; hash byte clipboard Preview sau chuẩn hóa CRLF→LF, không thêm terminator, là `9aca118338266acf6e5cbc719ea4c87b50b940d724bd4a92c47a0380e7f9e521`. Manifest phân biệt hai giá trị. Browser-derived hash và Python tái dựng đối chiếu bằng nhau; canonical adapter hash vẫn `664231124ae48369f6f1badc1d108db87b65bde7f8c0cc6e6e69787418ae4c5a`.

Các cổng V2 còn mở gồm scope cán bộ theo đơn vị/lớp; lifecycle/intake/waitlist/Owner policy và mất Authenticator; snapshot legacy/migration/rollback được phép; ba thiết bị ký thật và thiết bị vật lý; load/CPU/D1 Free; tích hợp PR #107; reviewer người độc lập và phê duyệt đúng artifact. Source Bơi Ếch vẫn local `802a5b6124d3d4406ae16a6beeb3ff634a762887`; lần push trước bị automatic approval review từ chối “unacceptable risk”, không thử đường khác để vượt chặn. Không phát hành V2 hoặc bắt đầu PR đào tạo/chứng nhận.

**Cổng phát hành:** PR #378 và bằng chứng đã sẵn để người có thẩm quyền review đúng source/artifact; cần review người độc lập và Owner phê duyệt đúng artifact + môi trường trước merge/publish. Phiên đăng nhập App Production hiện yêu cầu Google xác minh lại trên thiết bị Owner; không vượt cổng này. Giữ Production hiện hữu trong lúc chờ.

Bằng chứng: `docs/evidence/cloudflare-preview-hotfix-20261108/` gồm `browser-qa.json`, `verification.json`, `source-manifest.json`, log nén, ảnh readback và review. SHA compiled là hash UTF-8 chuẩn hóa LF, không phải hash nguyên gói Cloudflare upload.

[Preview quản lý kết nối](https://application-management-preview.boiech-ai.workers.dev/apps/boi-ech/cloudflare-preview) · [Production App-Management](https://application-management.boiech-ai.workers.dev) · [Preview Bơi Ếch](https://boi-ech-preview.boiech-ai.workers.dev) · [Production Bơi Ếch](https://boi-ech.boiech-ai.workers.dev) · [Issue #108](https://github.com/BlueDragon33/BOIECH_AI/issues/108) · [PR #107](https://github.com/BlueDragon33/BOIECH_AI/pull/107).

# BaumanWeb — Offline Ops in Application Manager

## Cơ chế

- Offline: mở duy nhất localhost đã đăng ký trong control/local-ops-apps.json. Nhấn icon sẽ yêu cầu script run-all.mjs khởi động các runtime đã hỗ trợ. Không fallback online.
- Online: chỉ mở publicUrl HTTPS trong application registry (bản publish trước đó); không mở Preview và không publish.
- Pull all: tìm repository trong thư mục BaumanWeb (tối đa 2 cấp); chỉ thực hiện fetch + merge --ff-only khi nhánh main sạch và lịch sử fast-forward, origin gốc và URL sau rewrite đều thuộc GitHub BlueDragon33. Từ chối file://, ext::, origin khác chủ sở hữu; không can thiệp cấu hình Git. Repo dirty/diverged/khác nhánh hoặc thay đổi trong khi fetch sẽ bỏ qua, hiển thị lý do. SHA trước/sau được giữ đầy đủ 40 ký tự và xác minh HEAD bằng FETCH_HEAD sau cập nhật; không reset hay force. Cần Internet để pull, nhưng không cần GitHub khi chạy offline.

## Khởi động Windows

1. Đặt các repo dưới <ổ đĩa>:\BaumanWeb và cài Node.js >=22.13.0, Git. Cài sẵn dependencies cho các app cần chạy.
2. Nhấp đúp START_BAUMANWEB.vbs trong thư mục Application-Management. Đây là launcher một lần, khởi động helper và local stack ngầm qua Windows, tự mở trình duyệt khi Center sẵn sàng; không phải gõ lệnh CMD.
3. Ở App Manager chọn Offline/Online rồi ấn icon tương ứng. Nhấn Pull all khi đã có mã mới merge lên GitHub.
4. Sau khi Pull all cập nhật mã, trạng thái `restartRequired` sẽ bật khi stack đang chạy. App Manager không cho mở nhầm runtime cũ như bản mới. Dừng stack cũ đúng quy trình, rồi chạy lại `START_BAUMANWEB.vbs`; kiểm tra endpoint/phiên bản trước khi coi là nghiệm thu. Chưa có restart cưỡng bức tự động vì `taskkill /F /T` có thể làm hỏng giao dịch D1. Không hot reload mã server đang chạy.

Nếu startup lỗi, nhấp CHECK_LOCAL_OPS.bat để kiểm tra; xem log .local-ops-bootstrap.log và .local-ops-runtime.log (không commit).

## Giới hạn bảo mật

Helper chỉ nghe 127.0.0.1:3011; yêu cầu loopback peer, Host chính xác, Origin App Manager localhost:3000 + token phiên. Mô hình token localhost không chống được phần mềm độc hại chạy trên chính máy hoặc ứng dụng giả mạo chiếm cổng 3000; không coi đây là xác thực người dùng. Probe offline không đi theo redirect đến web online. API chỉ hỗ trợ status, start và pull-all; không cho nhập shell, URL, đường dẫn hoặc lệnh bất kỳ. Không mở port helper ra LAN, không đưa phiên này lên cloud và không sử dụng để cấp quyền Production.

## Ports và phạm vi

Center 3000; Health 3001; RU_LIFE 3002; Bauman Control 3003; Bơi ếch 3004; Bauman Runtime 3005; GrowUP runtime 3006/control 3007; PriceReport runtime 3008/control 3009; NC03 3010.

Blueprint OS monorepo, CAD CAM 3D và PC Manager chưa có launcher localhost dùng chung đã được chứng minh. PC Manager vẫn sử dụng pcmanager://open trên Windows; các app chưa có runner không được nhận port giả hoặc xem là live. Những repo đó vẫn được Pull nếu chúng nằm trong BaumanWeb.

## Cổng nghiệm thu

Tự động CI gồm test giao thức localhost, các tình huống Pull all có Git fixture thật, và Docker --network none cho riêng route gốc App Manager; vẫn bắt buộc Windows cold-start trên BaumanWeb thật; verify D1 local; auth localhost; disconnected use; Pull clean/dirty/diverged; readback SHA; restart và runtime identity; CI regression; Blueprint 1.3.0. Không publish production để nghiệm thu.

## Bằng chứng kiểm thử bổ sung — phạm vi chính xác

- `scripts/local-d1-persistence-smoke.mjs`: Wrangler D1 **--local --persist-to** trong thư mục tạm của hệ điều hành; tạo bảng QA riêng, ghi marker, thoát process Wrangler rồi đọc marker ở process mới; tự dọn thư mục tạm. Không chạy `--remote`, không chạm D1 người dùng hay dữ liệu thật. Đây là bằng chứng tính bền của **fixture D1**, chưa xác nhận migration, auth và save/restore của từng app.
- `tests/local-ops-windows-smoke.test.mjs`: chạy trên Windows GitHub Actions, dựng `BaumanWeb/Application-Management` tạm, cold-start helper chỉ nghe loopback, thử phiên xác thực, dừng/mở lại helper và bảo đảm token cũ mất hiệu lực. **Không khởi động full 7-app stack**, không gọi launcher `--start` và không tự động xác nhận máy Windows của chủ sở hữu.
- `tests/local-ops-git-real.test.mjs`: Git bare/repo tạm, fast-forward, dirty/diverged, đối chiếu full SHA; không Pull kho thực.
- `scripts/local-isolated-network-none-smoke.mjs`: xác minh route `/` trung tâm trong `Docker --network none`; không chứng minh toàn bộ ứng dụng hay cơ sở dữ liệu có thể chạy khi mạng mất.
- Runtime đang chạy sau Pull: server trả `restartRequired=true`; App Manager từ chối coi HTTP 200 là bản đã Pull. **Không tự taskkill cưỡng bức** vì rủi ro với giao dịch SQLite/D1; restart full stack và SHA runtime readback trên Windows thật vẫn **BLOCKED**.

Nghiệm thu còn thiếu: thư mục BaumanWeb thật trên Windows, khởi động toàn hệ thống sau khi preload dependency, kiểm tra từng runtime identity/SHA, tính bền dữ liệu D1 sử dụng bởi app thật, đóng mở các process đúng quy trình và kiểm thử khi tháo Internet. Không thể đổi kết quả CI fixture thành `WINDOWS_FULL_STACK_PASS` hoặc `BLUEPRINT_APPROVED`.

## Restart supervisor + xác minh danh tính nguồn (Draft, chưa duyệt)

- API mới: `POST /restart` chỉ chấp nhận session localhost; **không bao giờ tắt tiến trình**. Nếu child `run-all` đang chạy, trả `409 MANUAL_SAFE_STOP_REQUIRED`. Nếu một trong các cổng 3000–3010 bị chiếm, trả lỗi và không khởi động đè lên dịch vụ khác.
- Trước khởi động, helper đối chiếu **Git root + branch main + SHA đầy đủ** của Application-Management và 7 ứng dụng có runtime trong `control/local-ops-apps.json`. Nếu thiếu repo/HEAD hoặc sai đường dẫn, fail-closed.
- `run-all` phát tín hiệu qua **IPC tiến trình cha–con** sau khi các contract/health đang có báo sẵn sàng, kèm snapshot nguồn do chính process `run-all` đọc. Helper bắt buộc kiểm tra nonce phiên khởi động, danh sách và SHA chính xác với snapshot trước và sau boot, rồi kiểm tra HTTP localhost từng cổng. Khi thiếu tín hiệu, process đã thoát, SHA lệch, app không phản hồi hoặc token sai, `sourceVerified=false`, ứng dụng không được đánh dấu ready.
- Mỗi lần kiểm tra trạng thái, helper đọc lại Git HEAD để phát hiện thay đổi ngoài `Pull all`; SHA thay đổi sẽ khóa trạng thái ready và yêu cầu restart. Bộ nhớ log có thể còn chứa mã cũ; API không tuyên bố đã cập nhật runtime nếu chưa kiểm thử.
- **Giới hạn:** IPC + SHA chứng minh child `run-all` khởi động từ cây nguồn đó và đã vượt kiểm tra contract/HTTP sẵn có; **không** thay cho SHA build do từng ứng dụng tự báo/được ký. Không có bảo đảm kết thúc sạch trên Windows khi nhánh `run-all` hiện còn dùng `taskkill /F`; **không triển khai auto-kill/auto-restart** cho đến khi có shutdown contract an toàn của toàn bộ child và D1.
- CI dùng kho Git thật và các server fixture tạm để mô phỏng post-Pull HEAD drift, khóa restart khi child còn sống, và kiểm tra SHA sau boot lần 2 trên Linux/Windows. Kết quả PASS này **không** tương đương kiểm thử 7 ứng dụng thật trên Windows/BaumanWeb của người dùng.

## Graceful shutdown R&D — phương án an toàn có kiểm soát

- `POST /restart-auto` là thao tác **preflight**, không phải lệnh ép tắt. IPC `local-ops-graceful/v1` sử dụng requestId/nonce gắn tiến trình `run-all` thực tế. Mọi yêu cầu thiếu Origin, token, tiến trình được quản lý hoặc đang bận đều bị từ chối.
- Preflight cần cam kết từ **đúng đủ 13 đơn vị** (run-all, run-local-system, ADMIN, HEALTH, RU, BAUMAN-CONTROL, BOI, BAUMAN-RUNTIME, GROWUP-CONTROL, GROWUP, PRICE-CONTROL, PRICE, NC03): `ownedProcess`, `d1Drained`, `gracefulExitSupported`, `supported` đều `true`. Thiếu hoặc lặp đơn vị, sai protocol, sai nonce, hết thời gian chờ => không có lệnh shutdown.
- `run-all` và `run-local-system` hiện **chưa có ACK thật** từ mọi Wrangler/Vite/Node child, còn đường điều khiển Windows `taskkill /F` của launcher legacy. Vì vậy preflight **trả UNSUPPORTED** và toàn bộ tiến trình giữ nguyên. Không thay tình huống này bằng ACK tự chế hoặc coi cổng đóng là bằng chứng drain D1.
- Khi sau này từng app có giao thức drain và xác minh thực tế, chỉ sau ACK preflight đầy đủ mới gửi shutdown commit. Helper tiếp tục yêu cầu ACK hoàn tất, tiến trình con `run-all` thật sự thoát, 3000–3010 không còn ai nghe; **chỉ sau đó** mới chạy lại bootstrap và xác minh full SHA & local health. Nếu bất kỳ điều kiện nào không đạt, giữ trạng thái BLOCKED, không force kill hoặc tự restart.
- CI Linux/Windows dùng mock child IPC đủ 13 cam kết để kiểm thử **đường điều phối dương tính** và giả lập missing drain để kiểm thử **từ chối âm tính**. Cam kết drain trong test là **synthetic**, không phản ánh SQLite/Wrangler thật, không có nghiệm thu full-stack trên Windows người dùng.


## Run Offline / Run All / Pull origin · giao diện yêu cầu (Draft only)

- `Run Offline · chọn app` là lựa chọn mở localhost, không phải bằng chứng đã mở cổng. Hiện chức năng `launchOffline(appId)` còn dùng `POST /start` chung cho run-all khi app chưa sẵn sàng; **không được trình bày là chỉ khởi động một app**. Cần thiết kế launcher từng app với dependency, PID, SHA, readiness và D1 drain riêng trước khi bật chức năng này.
- `Run All · mở sẵn` là thao tác chủ động gọi `POST /start` để prewarm các app được hỗ trợ; sau 202 chỉ là đang xác minh, không đồng nghĩa tất cả cổng sẵn sàng. Khi chưa được review, API từ chối ngay với HTTP 409 `RUN_ALL_BLOCKED` **trước khi khởi chạy/di chuyển D1**; không có cách bấm nút vượt gate.
- `Pull origin · tất cả main` là giao diện cho `/pull-all` sẵn có: chỉ `origin/main` sạch, ff-only và remote tin cậy; xem kết quả từng repo. Không lấy tự động Draft PR; chỉ nhận commit đã xuất hiện trên main sau merge. Git Pull cần mạng; chạy offline sau khi đã tải code không cần mạng. Nếu runtime đang chạy phải dừng an toàn và kiểm tra SHA mới, không ép kill/auto-restart.
- CI bắt buộc kiểm tra các nhãn/nút được nối hành động, block cấp API trước spawn khi admission thiếu và tính đúng của Pull. 10/10 BLOCKED, 0 READY, publication held; không nhận nhầm UX hoàn thiện trên máy người dùng.


## Offline-first fix: avoid unexpected online child URLs (Draft)

- Root causes: hosted dashboard initialized `online`, and `launchWeb` chose published URL whenever `localRuntime` was false; app grid used single click for details and double click for Open; popover `href` displayed a public/remote URL even in Offline mode.
- Correction: default Offline on both hosts. A hosted manager in Offline mode shows the localhost launcher requirement and refuses to open an online child. Online access can be selected manually. A localhost manager calls `launchOffline` with validated managed localhost ports; card single-click opens, right click / Shift+Click shows details. The popover no longer advertises online URL in Offline mode.
- This is navigation work, **NOT** proof of a running full stack, safe D1 quiescence or individual app spawn; Windows owner acceptance and Blueprint review still required before a safe merge. No release or ratification implied by green CI.


## Standalone Center startup (Draft, independent from blocked apps)

`START_BAUMANWEB.vbs` now requests `node scripts/local-ops-daemon.mjs --center`, which opens only Application Management at loopback 3000 using existing installed `node_modules/vite/bin/vite.js` and mode `standalone`. It must not run `run-all` implicitly, fetch npm packages, run database migrations, elevate Windows privileges, or kill unrelated processes. Use `npm ci` once while online if dependencies are absent; startup fails with a visible `.local-ops-bootstrap.log` and `.local-ops-center.log` reason. Manager 3000 HTTP readiness is not a SHA-attested app runtime. The 7 managed app runtimes and Run All remain fail-closed until actual source admission, process/port/D1 tests and independent review; this change does not mark any application READY. For a pre-existing 3000 listener, fail rather than claiming ownership.


### Pull origin while local app is running — safety fix

Pull all applies fast-forward only when the target repository is idle. A running Application-Management center, a managed stack, an owned app frontend, or an unknown listener on a manifest port makes the corresponding repository **SKIPPED** with `APP_MANAGER_ACTIVE`, `MANAGED_STACK_ACTIVE`, `APP_FRONTEND_ACTIVE` or `LOCAL_PORT_OCCUPIED`. All other repos continue to receive the existing clean-main/trusted-origin/fast-forward/SHA-readback check. **Do not** change source files underneath an active local D1 instance. Updating Application-Management itself requires closing the center safely then pulling from an independent trusted updater; no fake shutdown ACK/kill is introduced.


### Run All responsiveness / duplicate-start fix

When Run All is warming the client frontends, a click on an app joins that operation and polls its verified local port instead of sending a conflicting second `/start-app` request. If a different app is starting, the new requested app starts as soon as the helper becomes idle. A `blocked` owned runtime is never counted as successful `already-running-or-owned`. Frontend startup has a bounded 45-second port readiness wait, and UI errors point to a per-app local log. Still not real Windows owner acceptance.

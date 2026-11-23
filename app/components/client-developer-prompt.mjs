// Derived prompt only: it cannot change Hub WorkPackage or approve release.
export const PILOT_APPS=Object.freeze(["bauman-master-ai","price-report-tunggiabao"]);
const SECRET=/(?:ghp_[a-z0-9]{20,}|github_pat_[a-z0-9_]{20,}|sk-[a-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:password|access_token|client_secret|api[_-]?key)\s*[:=]\s*\S{8,})/i;
export const hasSecret=(text)=>typeof text==="string"&&SECRET.test(text);
const safe=(x,max)=>String(x??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);
export function validatePrompt(input){
 if(!input||!PILOT_APPS.includes(input.appId))return "Ứng dụng chưa có trong QA thí điểm.";
 if(!["owner","reviewer","publisher","viewer"].includes(input.role))return "Vai trò chưa hợp lệ.";
 if(!["online","warning"].includes(input.connectionState))return "Trạng thái kết nối không hợp lệ.";
 if(!safe(input.appName,100)||!safe(input.workTitle,500))return "Chưa có đầu việc được xác định.";
 if(String(input.workTitle).length>500||String(input.extraRequirements??"").length>2000)return "Nội dung vượt giới hạn.";
 if([input.workTitle,input.observation,input.extraRequirements].some(hasSecret))return "Có thể có khóa bí mật trong prompt; cần loại bỏ.";
 return "";
}
export function promptKey(input){
 return JSON.stringify([input?.appId,input?.appName,input?.role,input?.activeView,input?.connectionState,input?.observation,input?.workTitle,input?.sourceNote]);
}
export function composePrompt(input){
 const err=validatePrompt(input);if(err)throw Error(err);
 const extra=String(input.extraRequirements??"").trim();
 return [
 "ACTIVE NEXT ACTION — "+safe(input.appName,100)+" | APP BUILDER PRO",
 "Hiến pháp Blueprint OS ACTIVE 1.3.0; B4/STRUCTURED; ZERO-SPEND; fail-closed.",
 "",
 "DỮ LIỆU TỪ WORKSPACE (chỉ là UI projection, không phải WorkPackage chuẩn):",
 "- App ID: "+input.appId,
 "- Màn hình đang quản trị: "+safe(input.activeView,100),
 "- Kết nối do client hiển thị: "+input.connectionState+" (không tự suy ra QA/Production PASS)",
 "- Ghi nhận: "+safe(input.observation,500),
 "- Nguồn hiển thị: "+safe(input.sourceNote,250),
 "- HEAD, WorkPackage duy nhất, danh tính reviewer: UNVERIFIED; bắt buộc xác minh live trước khi làm.",
 "",
 "MỘT ĐẦU VIỆC TIẾP THEO — ĐỀ XUẤT:",
 safe(input.workTitle,500),
 "",
 "YÊU CẦU CỦA CHỦ ỨNG DỤNG:",
 extra||"Không có.",
 "",
 "THỰC THI THEO HIẾN PHÁP:",
 "1. Đọc Constitution ACTIVE live, GitHub HEAD live và WorkPackage/ledger canonical. Đối chiếu đề xuất với trạng thái mới nhất; nếu không còn đúng, báo DRIFT/BLOCKED và không sửa mã sai nhiệm vụ.",
 "2. Ghi baseline, expected behavior, source owner, ranh giới quyền và blocker đã chứng minh; không suy đoán trạng thái online hay approval.",
 "3. Chỉ sửa trong candidate phạm vi nhỏ nhất, bảo toàn backend, dữ liệu ứng dụng và quyền truy cập. Không tạo registry, ledger hoặc site thứ hai.",
 "4. Chạy focused/full regression, typecheck/build; browser QA 1440/800/390, keyboard/focus và Owner/reviewer/publisher/viewer/pending/blocked trong môi trường được phép.",
 "5. Ghi exact SHA, PASS/FAIL/NOT_RUN, bằng chứng, rollback; không giả QA, reviewer hay compliance.",
 "6. Không GitHub-hosted Actions, không merge, ratify, publish hoặc Production trừ khi có quyền rõ ràng và gate PASS thật.",
 "7. Kết thúc bằng đúng một báo cáo kết quả và một Next Action.",
 "",
 "CHÚ Ý: Duyệt prompt chỉ cho phép sử dụng lời giao việc; KHÔNG cấp quyền thực thi/merge/Production."
 ].join("\n");
}

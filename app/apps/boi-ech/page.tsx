import Link from "next/link";
import {requireChatGPTUser} from "../../chatgpt-auth";
export const dynamic="force-dynamic";
export default async function BoiEchAdminPage(){
  await requireChatGPTUser("/apps/boi-ech");
  return <main style={{maxWidth:780,margin:"42px auto",padding:24}}>
    <h1>Quản trị Cán bộ quản lý · Bơi Ếch</h1>
    <p>Hệ thống đã tách quyền xét duyệt: App-Manager chỉ duyệt tài khoản
      Cán bộ quản lý và điều chỉnh hạn mức chung. Cán bộ quản lý dùng Bơi Ếch
      để duyệt học viên, giảng viên và điều phối lớp học.</p>
    <p><Link href="/">Về Trung tâm Quản trị ứng dụng — mở mục Quyền / Cán bộ quản lý</Link></p>
    <p>Đường quản trị học viên/thanh toán cũ tại đây không còn quyền ghi. Không có tài khoản
      hoặc thiết bị hiện hữu nào tự động được duyệt trong quá trình chuyển đổi.</p>
  </main>;
}

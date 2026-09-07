import type { Metadata } from "next";
import { controlCenterSiteUrl } from "../site-links";
import { getMedicineAccess } from "../medicine-access.server";
import RuMedCheckClient from "./ru-medcheck-client";
import "./ru-medcheck.css";

export const metadata: Metadata = {
  title: "Hòa nhập Nga — Kiểm tra thuốc",
  description: "Ứng dụng người dùng để quét nhãn thuốc, trích hoạt chất và đối chiếu quy định của Liên bang Nga.",
  manifest: "/ru-medcheck.webmanifest",
  applicationName: "Hòa nhập Nga",
};

export const viewport = { themeColor: "#153a64" };

export default async function RuMedCheckPage() {
  const access = await getMedicineAccess();
  if (!access) {
    return <main className="ru-access-gate"><div><span>HÒA NHẬP NGA · TRUY CẬP ĐƯỢC DUYỆT TỪ XA</span><h1>Mở Web App từ Trung tâm quản trị</h1><p>Web App không có màn hình đăng nhập riêng. Hãy vào Trung tâm quản trị để xác thực tài khoản, duyệt thiết bị và cấp phiên truy cập Hòa nhập Nga.</p><a href={`${controlCenterSiteUrl}/medical-control`}>Mở Trung tâm Y tế</a><small>Chỉ phiên do Trung tâm cấp mới được dùng OCR, đối chiếu quy tắc và gửi kiểm duyệt.</small></div></main>;
  }
  return <RuMedCheckClient access={access} />;
}

import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import SecretGenerator from "./secret-generator";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tạo mật khẩu & Secret · Application Management",
  description: "Công cụ tạo mật khẩu và secret bằng Web Crypto, chạy hoàn toàn trong trình duyệt và không lưu dữ liệu.",
};

export default async function SecretGeneratorPage() {
  const user = await requireChatGPTUser("/tools/secret-generator");
  return <SecretGenerator user={{ displayName: user.displayName, email: user.email }} />;
}

import { requireChatGPTUser } from "../../chatgpt-auth";
import { getApplicationConfig } from "../../application-registry";
import PriceReportAdmin from "./price-report-admin";

export const dynamic = "force-dynamic";

export default async function PriceReportAdminPage() {
  const user = await requireChatGPTUser("/apps/price-report-tunggiabao");
  const application = getApplicationConfig("price-report-tunggiabao");
  if (!application) throw new Error("Không tìm thấy cấu hình PriceReport Tùng Gia Bảo.");
  return <PriceReportAdmin application={application} user={{ displayName: user.displayName, email: user.email }} />;
}

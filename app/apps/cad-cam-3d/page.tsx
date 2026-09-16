import { requireChatGPTUser } from "../../chatgpt-auth";
import { getApplicationConfig } from "../../application-registry";
import CadAdmin from "./cad-admin";

export const dynamic = "force-dynamic";

export default async function CadAdminPage() {
  const user = await requireChatGPTUser("/apps/cad-cam-3d");
  const application = getApplicationConfig("cad-cam-3d");
  if (!application) throw new Error("Không tìm thấy cấu hình CAD CAM 3D.");

  return (
    <CadAdmin
      application={application}
      user={{ displayName: user.displayName, email: user.email }}
    />
  );
}

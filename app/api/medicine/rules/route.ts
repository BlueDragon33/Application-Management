import { medicineJson, medicineMeta, readMedicineRules } from "../../../medicine.server";
import { getMedicineAccess } from "../../../medicine-access.server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await getMedicineAccess())) return medicineJson({ error: "Cần phiên truy cập do Trung tâm quản trị cấp." }, 401, true);
    return medicineJson({ ...medicineMeta, rules: await readMedicineRules(false) });
  } catch {
    return medicineJson({ error: "Cơ sở quy tắc Nga chưa sẵn sàng." }, 503);
  }
}

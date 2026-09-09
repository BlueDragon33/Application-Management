import { getApplicationConfig } from "../../application-registry";
import { requireChatGPTUser } from "../../chatgpt-auth";
import RuLifeAdmin from "./ru-life-admin";
import styles from "./ru-life-page.module.css";

export const dynamic = "force-dynamic";

export default async function RuLifeAdminPage() {
  const user = await requireChatGPTUser("/apps/ru-life");
  const application = getApplicationConfig("ru-life");
  const publicUrl = application?.publicUrl ?? "https://hoa-nhap-nga.dinhnam3391.chatgpt.site";

  return <div className={styles.pageShell}>
    <a className={styles.siteLauncher} href={publicUrl} target="_blank" rel="noreferrer" title="Mở site RU_LIFE độc lập để kiểm tra và sử dụng">
      Mở site RU_LIFE ↗
    </a>
    <div className={styles.siteLauncherNote}>Site mở độc lập. Thiết bị quản trị QT không tự kế thừa quyền truy cập HN.</div>
    <RuLifeAdmin user={{ displayName: user.displayName, email: user.email }} />
  </div>;
}

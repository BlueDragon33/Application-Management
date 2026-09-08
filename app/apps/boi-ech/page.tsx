import Link from "next/link";
import { requireChatGPTUser } from "../../chatgpt-auth";
import styles from "../../application-admin.module.css";
import BoiEchControlCenter from "./boi-ech-control-center";
import shell from "./boi-ech-shell.module.css";

export const dynamic = "force-dynamic";

export default async function BoiEchAdminPage() {
  const user = await requireChatGPTUser("/apps/boi-ech");
  return <div className={`${styles.boiRoute} ${shell.scope}`}>
    <Link href="/" className={styles.boiBack}>← Application Management</Link>
    <BoiEchControlCenter user={{ displayName: user.displayName, email: user.email }} />
  </div>;
}

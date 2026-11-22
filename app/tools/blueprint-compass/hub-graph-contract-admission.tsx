"use client";

import { useEffect, useState } from "react";
import styles from "./blueprint-compass.module.css";

type HubContractSnapshot = {
  ok: boolean;
  status: "UNAUTHORIZED" | "UNVERIFIED" | "HUB_GRAPH_NOT_EXPOSED" | "HUB_GRAPH_AUTH_NOT_ESTABLISHED";
  repository?: string;
  hubHead?: string;
  contractBlobSha?: string;
  contractSchema?: string;
  checkedAt?: string;
  canReadGraph: false;
  note?: string;
};

export default function HubGraphContractAdmission() {
  const [requested, setRequested] = useState(0);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<HubContractSnapshot | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setSnapshot(null);
    void fetch("/api/tools/blueprint-compass/hub-contract", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json() as HubContractSnapshot;
        if (controller.signal.aborted) return;
        if (!data || data.canReadGraph !== false || typeof data.status !== "string")
          throw new Error("Hub Graph contract readback không hợp lệ");
        if (response.ok !== data.ok) throw new Error("Hub contract status không đồng nhất");
        setSnapshot(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSnapshot({
          ok: false, status: "UNVERIFIED", canReadGraph: false,
          note: "Không xác minh được contract Hub. Không suy ra kết nối Graph.",
        });
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [requested]);

  const status = loading ? "Đang xác minh nguồn…" : snapshot?.status ?? "UNVERIFIED";
  return <section className={styles.hubAdmission} aria-labelledby="hub-contract-title" aria-live="polite">
    <div className={styles.hubAdmissionHeader}>
      <div>
        <small>HUB → APP · VERSIONED READ-ONLY CONTRACT</small>
        <h3 id="hub-contract-title">Cổng dữ liệu Graph Intelligence</h3>
      </div>
      <button type="button" onClick={() => setRequested(value => value + 1)}
        disabled={loading}>{loading ? "Đang đọc…" : "↻ Đối chiếu contract"}</button>
    </div>
    <p><strong>Trạng thái: {status}</strong></p>
    <p>{snapshot?.note ?? "Đang lấy contract theo HEAD đã ghim, không gọi endpoint Graph chưa được cấp quyền."}</p>
    {snapshot?.ok && snapshot.hubHead && snapshot.contractBlobSha ? <dl>
      <div><dt>Hub HEAD</dt><dd><code>{snapshot.hubHead}</code></dd></div>
      <div><dt>Contract blob</dt><dd><code>{snapshot.contractBlobSha}</code></dd></div>
      <div><dt>Nguồn</dt><dd>Public GitHub contract · {snapshot.checkedAt ?? "UNVERIFIED"}</dd></div>
    </dl> : null}
    <p className={styles.hubAdmissionBoundary}>Hiện chỉ cho phép kiểm tra contract công khai. Không có quyền đọc Graph canonical, WorkPackage, private evidence hay chạy Agent. Đồ thị phía trên tiếp tục lấy dữ liệu registry đã đăng ký.</p>
  </section>;
}

"use client";

import { useEffect, useState } from "react";
import styles from "./blueprint-compass.module.css";
import { validateHubContractReadback, type HubContractReadback } from "../../blueprint-hub-contract-readback.mjs";

export default function HubGraphContractAdmission() {
  const [requested, setRequested] = useState(0);
  const [loaded, setLoaded] = useState<{ request: number; snapshot: HubContractReadback } | null>(null);
  const snapshot = loaded && loaded.request === requested ? loaded.snapshot : null;
  const loading = snapshot === null;
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/tools/blueprint-compass/hub-contract", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data: unknown = await response.json();
        if (controller.signal.aborted) return;
        setLoaded({ request: requested, snapshot: validateHubContractReadback(data, response.status) });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ request: requested, snapshot: {
          ok: false, status: "UNVERIFIED", canReadGraph: false,
          note: "Không xác minh được contract Hub. Không suy ra kết nối Graph.",
        }});
      });
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

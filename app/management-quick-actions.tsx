"use client";

import { useMemo, useState } from "react";
import { applicationRegistry } from "./application-registry";
import { connectOperationsDashboard, operationsAction } from "./admin-device-client";

const PRIMARY_APP_IDS = new Set(["bauman-master-ai", "boi-ech", "health-care", "ru-life"]);

export default function ManagementQuickActions() {
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [webOpen, setWebOpen] = useState(false);
  const apps = useMemo(() => applicationRegistry.filter((app) => PRIMARY_APP_IDS.has(app.id)), []);

  function go(view: string) {
    window.location.assign(view === "overview" ? "/" : `/?view=${encodeURIComponent(view)}`);
  }

  async function refresh(label: string) {
    setBusy(label);
    setNotice("");
    try {
      await connectOperationsDashboard();
      window.dispatchEvent(new Event("focus"));
      setNotice(label === "sync" ? "Đã đồng bộ dữ liệu từ các ứng dụng." : "Đã làm mới trạng thái hệ thống.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật trạng thái hệ thống.");
    } finally {
      setBusy("");
    }
  }

  async function clearNotifications() {
    setBusy("clear");
    setNotice("");
    try {
      const result = await connectOperationsDashboard();
      const ids = result.bootstrap?.workItems.map((item) => item.id) ?? [];
      if (!ids.length) {
        setNotice("Không có mục chờ duyệt nào cần xóa khỏi danh sách hiển thị.");
        return;
      }
      if (!window.confirm(`Xóa ${ids.length} mục khỏi danh sách chờ duyệt? Dữ liệu nghiệp vụ gốc tại ứng dụng không bị xóa.`)) return;
      await operationsAction({ action: "dismiss-notifications", workItemIds: ids });
      await connectOperationsDashboard();
      window.dispatchEvent(new Event("focus"));
      setNotice("Đã dọn danh sách chờ duyệt; dữ liệu gốc vẫn được giữ nguyên.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể xóa danh sách chờ duyệt.");
    } finally {
      setBusy("");
    }
  }

  async function enableAutoApproval() {
    setBusy("auto");
    setNotice("");
    try {
      const result = await connectOperationsDashboard();
      const settings = result.bootstrap?.settings as { autoApproveSupportedAppIds?: string[]; autoApproveAppIds?: string[] } | undefined;
      const supported = settings?.autoApproveSupportedAppIds ?? [];
      if (!supported.length) {
        setNotice("Chưa có ứng dụng nào công bố contract duyệt tự động an toàn.");
        return;
      }
      const names = supported.map((id) => apps.find((app) => app.id === id)?.shortName ?? id).join(", ");
      if (!window.confirm(`Bật duyệt tự động cho các ứng dụng đã hỗ trợ: ${names}?`)) return;
      await operationsAction({ action: "set-auto-approval", appIds: supported });
      await connectOperationsDashboard();
      window.dispatchEvent(new Event("focus"));
      setNotice(`Đã bật duyệt tự động cho ${supported.length} ứng dụng được backend hỗ trợ.`);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật quy tắc duyệt tự động.");
    } finally {
      setBusy("");
    }
  }

  async function launchWeb(appId: string) {
    setBusy(`web:${appId}`);
    setNotice("");
    try {
      const dashboard = await connectOperationsDashboard();
      const summary = dashboard.bootstrap?.summaries.find((item) => item.appId === appId);
      const app = apps.find((item) => item.id === appId);
      const fallback = app?.publicUrl;
      if (!summary?.webHref && !fallback) throw new Error("Ứng dụng chưa công bố URL web hợp lệ.");

      if (summary?.managedWebLaunch) {
        const popup = window.open("about:blank", "_blank");
        if (popup) popup.opener = null;
        try {
          const result = await operationsAction({ action: "launch-client-web", appId });
          if (!result.launchUrl) throw new Error(result.error ?? "Không lấy được vé mở website ứng dụng.");
          if (popup) popup.location.replace(result.launchUrl);
          else window.location.assign(result.launchUrl);
        } catch (caught) {
          popup?.close();
          throw caught;
        }
      } else {
        window.open(summary?.webHref ?? fallback, "_blank", "noopener,noreferrer");
      }
      setWebOpen(false);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể mở website ứng dụng.");
    } finally {
      setBusy("");
    }
  }

  return <aside className="qtQuickDock" aria-label="Thao tác nhanh quản trị">
    <header className="qtQuickDockHeader">
      <div><span>⚡</span><strong>Thao tác nhanh</strong></div>
      <button type="button" onClick={() => setWebOpen(false)} aria-label="Thu gọn trình mở web">•</button>
    </header>

    <div className="qtQuickDockGrid">
      <button type="button" onClick={() => go("applications")}><span>◇</span><b>Quản trị ứng dụng</b></button>
      <button type="button" data-active={webOpen} onClick={() => setWebOpen((value) => !value)}><span>◎</span><b>Truy cập web</b></button>
      <button type="button" onClick={() => go("approvals")}><span>▣</span><b>Duyệt thiết bị</b></button>
      <button type="button" onClick={() => go("access")}><span>⬡</span><b>Phê duyệt quyền</b></button>
      <button type="button" data-danger="true" disabled={Boolean(busy)} onClick={() => void clearNotifications()}><span>⌫</span><b>{busy === "clear" ? "Đang xóa…" : "Xóa hết thông báo"}</b></button>
      <button type="button" disabled={Boolean(busy)} onClick={() => void enableAutoApproval()}><span>⚙</span><b>{busy === "auto" ? "Đang lưu…" : "Duyệt tự động"}</b></button>
      <button type="button" disabled={Boolean(busy)} onClick={() => void refresh("sync")}><span>↻</span><b>{busy === "sync" ? "Đang đồng bộ…" : "Đồng bộ tất cả"}</b></button>
      <button type="button" disabled={Boolean(busy)} onClick={() => void refresh("refresh")}><span>⟳</span><b>{busy === "refresh" ? "Đang làm mới…" : "Làm mới trạng thái"}</b></button>
      <button type="button" onClick={() => go("audit")}><span>▤</span><b>Xem nhật ký</b></button>
    </div>

    {webOpen ? <div className="qtQuickWebMenu">
      <strong>Mở website sử dụng</strong>
      <small>Chọn đúng ứng dụng cần truy cập.</small>
      <div>{apps.map((app) => <button type="button" key={app.id} disabled={Boolean(busy)} onClick={() => void launchWeb(app.id)}><span>{app.shortName}</span><b>{busy === `web:${app.id}` ? "Đang mở…" : "Mở ↗"}</b></button>)}</div>
    </div> : null}

    {notice ? <div className="qtQuickDockNotice" role="status">{notice}</div> : null}
  </aside>;
}

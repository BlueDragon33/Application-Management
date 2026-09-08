import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import MedicalControlClient from "./medical-control-client";
import "./medical-control.css";
import "./medical-control-enhancements.css";

export const metadata: Metadata = { title: "Hòa nhập Nga · QUẢN TRỊ ỨNG DỤNG" };
export const dynamic = "force-dynamic";

export default async function MedicalControlPage() {
  const user = await requireChatGPTUser("/medical-control");
  return <>
    <MedicalControlClient user={{ displayName: user.displayName, email: user.email }} />
    <div
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 82,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 7,
      }}
    >
      <a
        href="/medical-control/integration-health"
        style={{
          padding: "10px 13px",
          border: "1px solid rgba(103,210,159,.22)",
          borderRadius: 10,
          background: "#173c2d",
          color: "#9be1b9",
          boxShadow: "0 14px 34px rgba(0,0,0,.24)",
          textDecoration: "none",
          fontSize: 11,
          fontWeight: 850,
        }}
      >
        Kiểm tra kết nối RU_LIFE →
      </a>
      <a
        href="/medical-control/device-classification"
        style={{
          padding: "9px 12px",
          border: "1px solid rgba(217,177,80,.18)",
          borderRadius: 10,
          background: "#2e291c",
          color: "#d9bf82",
          boxShadow: "0 12px 28px rgba(0,0,0,.2)",
          textDecoration: "none",
          fontSize: 10,
          fontWeight: 850,
        }}
      >
        Phân loại thiết bị HN →
      </a>
    </div>
  </>;
}

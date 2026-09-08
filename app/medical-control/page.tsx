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
    <a
      href="/medical-control/device-classification"
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 82,
        padding: "10px 13px",
        border: "1px solid rgba(217,177,80,.22)",
        borderRadius: 10,
        background: "#173c2d",
        color: "#9be1b9",
        boxShadow: "0 14px 34px rgba(0,0,0,.24)",
        textDecoration: "none",
        fontSize: 11,
        fontWeight: 850,
      }}
    >
      Phân loại thiết bị HN →
    </a>
  </>;
}

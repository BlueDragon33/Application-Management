"use client";

import { useEffect, useState } from "react";

const LOCAL_LINKS = [
  { label: "Bơi ếch", href: "http://127.0.0.1:3004/" },
  { label: "Sức khỏe Y tế", href: "http://127.0.0.1:3001/suc-khoe-tre" },
  { label: "Hòa nhập Nga", href: "http://127.0.0.1:3002/" },
  { label: "Bauman Runtime", href: "http://127.0.0.1:3005/" },
] as const;

function isLoopback(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
}

export default function LocalQuickAccess() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(isLoopback(window.location.hostname));
  }, []);

  if (!visible) return null;

  return (
    <aside
      aria-label="Truy cập nhanh hệ thống local"
      style={{
        position: "fixed",
        left: 20,
        bottom: 20,
        zIndex: 91,
        width: 250,
        padding: 14,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,.13)",
        background: "rgba(8, 30, 24, .96)",
        boxShadow: "0 16px 38px rgba(0,0,0,.32)",
        color: "#eefcf7",
        backdropFilter: "blur(12px)",
      }}
    >
      <strong style={{ display: "block", fontSize: 14, marginBottom: 4 }}>LOCAL · Truy cập trực tiếp</strong>
      <small style={{ display: "block", opacity: .72, lineHeight: 1.35, marginBottom: 10 }}>
        Không phụ thuộc trạng thái contract quản trị.
      </small>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        {LOCAL_LINKS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#f5fffb",
              textDecoration: "none",
              background: "rgba(18,118,94,.68)",
              border: "1px solid rgba(93,224,188,.18)",
              borderRadius: 10,
              padding: "8px 9px",
              fontSize: 12,
              fontWeight: 750,
              textAlign: "center",
            }}
          >
            {item.label} ↗
          </a>
        ))}
      </div>
      <a
        href="/tools/contract-diagnostics"
        style={{
          display: "block",
          marginTop: 8,
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px solid rgba(246,195,74,.28)",
          background: "rgba(94,72,14,.34)",
          color: "#ffe9a5",
          textDecoration: "none",
          fontSize: 12,
          fontWeight: 800,
          textAlign: "center",
        }}
      >
        Chẩn đoán contract →
      </a>
    </aside>
  );
}

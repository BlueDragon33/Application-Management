"use client";

import { useId, useRef, useState } from "react";

export function PublicReleaseLink({ url }: { url: string }) {
  const inputId = useId();
  const linkField = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Đã sao chép link chia sẻ.");
    } catch {
      linkField.current?.focus();
      linkField.current?.select();
      setMessage("Địa chỉ đã được chọn. Dùng lệnh Sao chép của thiết bị.");
    }
  }

  return (
    <>
      <p><a href={url} target="_blank" rel="noopener noreferrer">Mở Russian Display-Master</a></p>
      <label htmlFor={inputId}>Link chia sẻ</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <input
          ref={linkField}
          id={inputId}
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          style={{ flex: "1 1 16rem", minWidth: 0, minHeight: 44, padding: "0 10px" }}
        />
        <button type="button" onClick={() => void copyLink()} style={{ minHeight: 44, padding: "0 12px" }}>
          Sao chép link chia sẻ
        </button>
      </div>
      <p role="status">{message}</p>
    </>
  );
}

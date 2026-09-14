"use client";

import { useEffect } from "react";

const replacements = new Map([
  ["Quản trị Ứng dụng Ver2", "Quản trị Ứng dụng"],
  ["Kiểm soát Ver2", "Kiểm soát vận hành"],
  ["v2.0", ""],
  ["Contract Bauman chưa xác nhận device control v4 sẵn sàng.", "Contract Bauman chưa xác nhận điều khiển thiết bị sẵn sàng."],
]);

function cleanVisibleReleaseLabels(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const value = current.nodeValue?.trim();
    if (value && replacements.has(value)) current.nodeValue = replacements.get(value) ?? "";
    current = walker.nextNode();
  }
}

export default function ReleaseLabelCleanup() {
  useEffect(() => {
    cleanVisibleReleaseLabels(document.body);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            const value = node.nodeValue?.trim();
            if (value && replacements.has(value)) node.nodeValue = replacements.get(value) ?? "";
          } else if (node instanceof Element) cleanVisibleReleaseLabels(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}

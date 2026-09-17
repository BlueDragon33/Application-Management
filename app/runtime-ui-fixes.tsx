"use client";

import { useEffect } from "react";

/* Keep runtime intervention intentionally tiny. The published UI is the source
   of truth; this helper only removes the two footer strips the user explicitly
   asked to remove. No layout, application filtering, font sizing or panel
   reordering happens here. */
function removeUnwantedFooterStrips() {
  document.querySelectorAll<HTMLElement>(".modernAppsPager").forEach((node) => {
    node.style.setProperty("display", "none", "important");
  });

  const candidates = Array.from(document.querySelectorAll<HTMLElement>("footer, div, span"));
  for (const node of candidates) {
    if (node.children.length > 4) continue;
    const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const isScrollFooter = text === "Cuộn để xem thêm" || text.startsWith("Cuộn để xem thêm ");
    const isAppPager = /^\d+\s+ứng dụng\s*·\s*tối đa\s*3\s+ứng dụng\s+mỗi\s+lượt/.test(text);
    if (!isScrollFooter && !isAppPager) continue;

    const target = node.closest("footer") ?? node.parentElement ?? node;
    target.style.setProperty("display", "none", "important");
  }
}

export default function RuntimeUiFixes() {
  useEffect(() => {
    removeUnwantedFooterStrips();

    const timers = [80, 220, 600, 1200].map((delay) =>
      window.setTimeout(removeUnwantedFooterStrips, delay),
    );
    const onNavigation = () => window.setTimeout(removeUnwantedFooterStrips, 0);
    window.addEventListener("popstate", onNavigation);
    window.addEventListener("management:view-change", onNavigation);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("popstate", onNavigation);
      window.removeEventListener("management:view-change", onNavigation);
    };
  }, []);

  return null;
}

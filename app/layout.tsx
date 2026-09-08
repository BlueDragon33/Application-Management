import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Application Management · Trung tâm quản trị ứng dụng",
  description: "Control-plane quản lý ứng dụng, thiết bị quản trị, quyền truy cập và nhật ký bảo mật của hệ thống.",
  applicationName: "Application Management",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Application Management", statusBarStyle: "default" },
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export const viewport = { themeColor: "#173b33" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}

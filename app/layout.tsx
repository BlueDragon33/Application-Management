import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QUẢN TRỊ ỨNG DỤNG",
  description: "Trung tâm điều phối các Site Bauman, Bơi ếch, Sức khỏe và những ứng dụng được kết nối.",
  applicationName: "QUẢN TRỊ ỨNG DỤNG",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Quản trị ứng dụng", statusBarStyle: "default" },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport = { themeColor: "#173b33" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

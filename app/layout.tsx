import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "配音擂台（暫定名稱）",
  description: "UGC 影片配音評分遊戲 Phase 1 示範",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}

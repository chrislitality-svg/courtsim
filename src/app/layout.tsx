import type { Metadata } from "next";
import { Ma_Shan_Zheng, Noto_Serif_SC } from "next/font/google";
import "./globals.css";

const notoSerif = Noto_Serif_SC({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-cs-serif",
  display: "swap",
});

const maShan = Ma_Shan_Zheng({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-cs-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CourtSim · 朝堂风云",
  description: "多 Agent 历史场景推演引擎（MVP）",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`h-full antialiased ${notoSerif.variable} ${maShan.variable}`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

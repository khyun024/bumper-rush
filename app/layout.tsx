import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bumper Rush — 범퍼카 배틀 아레나",
  description: "박고, 버티고, 끝까지 살아남는 모바일 범퍼카 배틀 게임",
  openGraph: { title:"Bumper Rush", description:"끝까지 버텨라!", images:["/og.png"] },
  twitter: { card:"summary_large_image", title:"Bumper Rush", description:"끝까지 버텨라!", images:["/og.png"] },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

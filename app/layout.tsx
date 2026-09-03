import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "SnapNote",
  description: "SnapNote — 오답노트 학습 도우미",
  icons: {
    icon: "/favicon.png",
    apple: "/icon.png",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
      </head>
      <body style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        {children}
      </body>
    </html>
  );
}

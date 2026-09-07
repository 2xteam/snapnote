import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
// globals.css **다음 줄**이라야 한다 — .sheet--point 가 특이도 같은
// .sheet { border-radius: var(--radius-lg) } 를 이겨야 한다.
// 생성 파일이다: myjane/design/elements.css → npm run elements -- --write
import "./elements.css";

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
        {/*
          결쩜사와 동일한 서체 조합.
          본문·라벨은 Pretendard, 큰 헤드라인은 Gowun Batang(명조) 700.

          ⚠️ `.headline` 이 "Gowun Batang" 을 요구하는데 이 링크가 없으면 조용히
          일반 명조로 떨어진다. body 의 Pretendard 도 마찬가지다 — 다른 앱과
          글자체가 미묘하게 달라 보이는 원인이었다 (2026-09-07 발견).
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css"
        />
      </head>
      <body style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        {children}
      </body>
    </html>
  );
}

import "./globals.css";

export const metadata = {
  title: "한 톨의 시간",
  description: "밥그릇 속 쌀알을 세어 기록에 도전하세요."
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

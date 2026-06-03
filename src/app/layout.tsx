import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
// Self-hosted fonts (latin subset only) so the build never reaches out to
// Google Fonts. Chakra Petch / Noto Sans JP are exposed to components via the
// CSS variables declared in globals.css.
import "@fontsource/chakra-petch/latin-600.css";
import "@fontsource/chakra-petch/latin-700.css";
import "@fontsource/noto-sans-jp/latin-400.css";
import "@fontsource/noto-sans-jp/latin-500.css";
import "@fontsource/noto-sans-jp/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "GEAR-UI — AI Screen Mock Generator",
  description:
    "AIで画面UI定義書とHTMLモックを2段パイプラインで生成する OSS ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

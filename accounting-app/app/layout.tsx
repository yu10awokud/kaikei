import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_JP } from 'next/font/google';
import './globals.css';

// ============================================================
// フォント（既存サイトと同じ組み合わせ）
//   日本語：Noto Sans JP ／ 数字・英字：Inter
// ============================================================
const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jp',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-en',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '水泳部 会計管理システム',
  description: '部費・プリペイド・後援会費の収支と立替を一元管理します。',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}

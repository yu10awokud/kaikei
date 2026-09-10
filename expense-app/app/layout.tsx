import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_JP } from 'next/font/google';
import SiteHeader from '@/components/SiteHeader';
import './globals.css';

// ============================================================
// フォント（既存サイトと同じ組み合わせ）
//   日本語：Noto Sans JP ／ 数字・英字：Inter
//   next/font がビルド時に取り込むので、表示時に外部へ取りに行きません。
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
  title: '京府医水泳部会計 領収書保存クラウド',
  description: '練習ごとの立替を、領収書の写真つきで記録・集計します。',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // スマホでの拡大は許可（領収書を見やすくするため）
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${inter.variable}`}>
      <body>
        <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6">
          <header className="mb-6">
            <SiteHeader />
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}

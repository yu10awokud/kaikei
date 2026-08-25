import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_JP } from 'next/font/google';
import './globals.css';

// ============================================================
// フォント
//   日本語：Noto Sans JP（読みやすく、どの端末でも同じ見た目になる）
//   数字・英字：Inter（数字が読み違えにくい UI 向けフォント）
//   next/font がビルド時にフォントを取り込むので、
//   表示時に外部へ取りに行かず、文字がガタつきません。
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
  title: 'メニュー特戦隊',
  description: 'KPUM SWIM TEAM MENU PAGE',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // スマホでの拡大は許可（見づらいときに拡大できるように）
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${inter.variable}`}>
      <body>
        <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6">{children}</div>
      </body>
    </html>
  );
}

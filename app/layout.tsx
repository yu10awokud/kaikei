import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'メニュー特戦隊',
  description: '大学水泳部 メニュー係の管理サイト',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // スマホでの拡大は許可（見づらいときに拡大できるように）
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-5 sm:px-6">{children}</div>
      </body>
    </html>
  );
}

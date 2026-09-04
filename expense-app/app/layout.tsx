import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: '部費立替メモ',
  description: '練習ごとの立替を、領収書の写真つきで記録・集計します。',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 入力欄をタップしたときに勝手に拡大されないようにする
  maximumScale: 1,
};

const TABS = [
  { href: '/', label: '練習' },
  { href: '/expenses', label: '立替一覧' },
  { href: '/summary', label: '集計' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="border-b border-line bg-white">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3">
            <span className="text-base font-bold">部費立替メモ</span>
            <span className="text-xs text-sub">KPUM水泳部 会計</span>
          </div>
          <nav className="mx-auto flex w-full max-w-2xl gap-1 px-4">
            {TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className="rounded-t-lg px-4 py-2 text-sm font-bold text-sub hover:bg-bg hover:text-ink"
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="container-app">{children}</main>
      </body>
    </html>
  );
}

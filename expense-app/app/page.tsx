import Link from 'next/link';
import AppTabs from '@/components/AppTabs';

// 練習予定は必ず最新を取りに行くので、ページはキャッシュしない
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <>
      <AppTabs />

      {/* 管理画面へは、既存サイトと同じように目立たないリンクで */}
      <footer className="mt-14 border-t border-line pt-5 text-center">
        <Link href="/admin" className="text-[11px] text-ink-faint underline underline-offset-2">
          管理画面
        </Link>
      </footer>
    </>
  );
}

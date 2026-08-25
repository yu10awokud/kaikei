import Link from 'next/link';
import DutySection from '@/components/duty/DutySection';
import LinksSection from '@/components/links/LinksSection';
import ManualCards from '@/components/manual/ManualCards';
import TemplateSection from '@/components/template/TemplateSection';
import { fetchInitialData } from '@/lib/queries';

// 常に最新のデータを表示する（キャッシュしない）
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { members, places, assignments, configured, error } = await fetchInitialData();

  return (
    <main className="space-y-12">
      <header className="pb-1">
        <h1 className="text-[26px] font-bold tracking-tight text-ink sm:text-3xl">メニュー特戦隊</h1>
        <p className="font-en mt-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-faint">
          KPUM Swim Team Menu Page
        </p>
      </header>

      {error && (
        <p className="rounded-card border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          データの読み込みでエラーが発生しました：{error}
        </p>
      )}

      <DutySection
        initialAssignments={assignments}
        members={members}
        places={places}
        configured={configured}
      />
      <TemplateSection />
      <ManualCards />
      <LinksSection />

      {/* 管理画面へは目立たないリンクで */}
      <footer className="border-t border-line pt-5 text-center">
        <Link href="/admin" className="text-[11px] text-ink-faint underline underline-offset-2">
          管理画面
        </Link>
      </footer>
    </main>
  );
}

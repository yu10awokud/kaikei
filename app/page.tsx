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
    <main className="space-y-10">
      <header className="pb-1">
        <h1 className="text-2xl font-bold tracking-tight">メニュー特戦隊</h1>
        <p className="mt-1 text-xs tracking-wide text-neutral-500">KPUM SWIM TEAM MENU PAGE</p>
      </header>

      {error && (
        <p className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          データの読み込みでエラーが発生しました：{error}
        </p>
      )}

      <TemplateSection />
      <ManualCards />
      <DutySection
        initialAssignments={assignments}
        members={members}
        places={places}
        configured={configured}
      />
      <LinksSection />

      {/* 管理画面へは目立たないリンクで */}
      <footer className="border-t border-line pt-4 text-center">
        <Link href="/admin" className="text-[11px] text-neutral-400 underline">
          管理画面
        </Link>
      </footer>
    </main>
  );
}

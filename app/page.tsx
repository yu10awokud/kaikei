import Link from 'next/link';
import HomeTabs from '@/components/HomeTabs';
import SiteHeader from '@/components/SiteHeader';
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
    <main>
      <header className="mb-6">
        <SiteHeader />
      </header>

      {error && (
        <p className="mb-6 rounded-card border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          データの読み込みでエラーが発生しました：{error}
        </p>
      )}

      <HomeTabs
        home={
          <div className="space-y-12">
            {/* 次回の練習 ＋ カレンダー ＋ 直近1週間 */}
            <DutySection
              initialAssignments={assignments}
              members={members}
              places={places}
              configured={configured}
            />
            <LinksSection />
          </div>
        }
        manual={
          <div className="space-y-12">
            <TemplateSection />
            <ManualCards />
          </div>
        }
      />

      {/* 管理画面へは目立たないリンクで */}
      <footer className="mt-14 border-t border-line pt-5 text-center">
        <Link href="/admin" className="text-[11px] text-ink-faint underline underline-offset-2">
          管理画面
        </Link>
      </footer>
    </main>
  );
}

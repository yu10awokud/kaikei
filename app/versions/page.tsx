import Link from 'next/link';
import ReleaseList from '@/components/releases/ReleaseList';
import { fetchReleases } from '@/lib/queries';
import { isSupabaseConfigured } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'バージョン管理 ｜ メニュー特戦隊' };

export default async function VersionsPage() {
  const releases = await fetchReleases();
  const configured = isSupabaseConfigured();

  return (
    <main>
      <Link
        href="/"
        className="text-[13px] font-medium text-ink-faint underline underline-offset-2"
      >
        ← トップに戻る
      </Link>

      <header className="mt-4 mb-5">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-ink">バージョン管理</h1>
          <span className="font-en text-[10px] font-medium uppercase tracking-[0.16em] text-ink-faint">
            Version Log
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-faint">更新履歴と担当者を確認</p>
      </header>

      {!configured && (
        <p className="mb-4 rounded-card border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Supabase の環境変数が未設定です（.env.local を確認してください）。
        </p>
      )}

      <ReleaseList initialReleases={releases} />
    </main>
  );
}

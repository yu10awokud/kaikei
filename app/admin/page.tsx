import Link from 'next/link';
import DeletedAssignments from '@/components/admin/DeletedAssignments';
import MasterAdmin from '@/components/admin/MasterAdmin';
import SectionHeader from '@/components/SectionHeader';
import { fetchDeletedAssignments, fetchInitialData } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata = { title: '管理画面 ｜ メニュー特戦隊' };

export default async function AdminPage() {
  const [{ members, places, configured }, deleted] = await Promise.all([
    fetchInitialData(),
    fetchDeletedAssignments(),
  ]);

  return (
    <main className="space-y-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 underline">
          ← トップに戻る
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">管理画面</h1>
        <p className="mt-1 text-xs text-neutral-500">
          部員・練習場所の設定と、削除した割り当ての復元ができます。
        </p>
      </header>

      {!configured && (
        <p className="rounded-card border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Supabase の環境変数が未設定です（.env.local を確認してください）。
        </p>
      )}

      <section>
        <SectionHeader
          emoji="🧑"
          title="部員"
          description="引退・卒業しても削除せず、「在籍中」のチェックを外してください（過去の集計が壊れないようにするため）。"
        />
        <MasterAdmin endpoint="members" label="部員" activeLabel="在籍中（担当者プルダウンに表示する）" initialItems={members} />
      </section>

      <section>
        <SectionHeader emoji="📍" title="練習場所" />
        <MasterAdmin endpoint="places" label="練習場所" activeLabel="有効（場所プルダウンに表示する）" initialItems={places} />
      </section>

      <section>
        <SectionHeader emoji="🗑" title="削除した割り当て" description="削除は取り消せます。復元すると担当日に戻ります。" />
        <DeletedAssignments initialItems={deleted} />
      </section>
    </main>
  );
}

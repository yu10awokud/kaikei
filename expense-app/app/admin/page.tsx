import Link from 'next/link';
import PayerAdmin from '@/components/admin/PayerAdmin';

export const dynamic = 'force-dynamic';

export const metadata = { title: '管理画面 ｜ 京府医水泳部会計 領収書保存クラウド' };

export default function AdminPage() {
  return (
    <div>
      <Link href="/" className="text-[13px] font-medium text-ink-faint underline underline-offset-2">
        ← トップに戻る
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">管理画面</h1>
      <p className="mt-1 text-xs text-ink-faint">立替者マスタの追加・削除ができます。</p>

      <section className="mt-8">
        <div className="section-title">
          <h2>立替者</h2>
          <span>Payers</span>
        </div>
        <p className="mb-3 text-[13px] text-ink-soft">
          立替の入力画面で選べる人の一覧です。
          <strong className="font-bold">
            これはこのアプリだけのマスタで、既存サイト（メニュー特戦隊）のメニュー担当者とは別物です。
          </strong>
          ここを直しても、既存サイトには一切反映されません。
        </p>
        <p className="mb-4 text-[13px] text-ink-soft">
          削除しても、その人の過去の立替の記録は消えません（記録には名前が控えてあるので、
          一覧や集計にはそのまま残ります）。
          一時的にプルダウンから外したいだけなら、チェックを外してください。
        </p>
        <PayerAdmin />
      </section>
    </div>
  );
}

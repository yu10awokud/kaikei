import Accordion from '@/components/ui/Accordion';
import { getAuthState } from '@/lib/auth';
import {
  ACCOUNT_KIND_LABELS,
  PAYMENT_MODE_LABELS,
  type Account,
  type Facility,
  type Member,
  type TransactionType,
} from '@/lib/types';

// ============================================================
// ホーム（第1段階：ログインとデータベース接続の確認画面）
//   第2段階でテンプレートボタン、第4段階で残高・検算を追加する。
// ============================================================

function Inactive({ active }: { active: boolean }) {
  return active ? null : <span className="tag ml-2 bg-line-soft text-ink-faint">無効</span>;
}

export default async function HomePage() {
  const auth = await getAuthState();
  if (auth.status !== 'ok') return null; // layout で処理済み
  const { supabase, email } = auth;

  const [accounts, facilities, types, members, allowed] = await Promise.all([
    supabase.from('accounts').select('id, name, kind, sort_order, is_active').order('sort_order'),
    supabase.from('facilities').select('id, name, payment_mode, sort_order, is_active').order('sort_order'),
    supabase.from('transaction_types').select('id, name, code, sort_order, is_active').order('sort_order'),
    supabase.from('members').select('id, name, sort_order, is_active').order('sort_order'),
    supabase.from('allowed_users').select('email, note').order('email'),
  ]);

  const firstError = [accounts, facilities, types, members, allowed].find((r) => r.error)?.error;

  return (
    <div className="space-y-6">
      <section>
        <div className="section-title">
          <h2>接続確認</h2>
          <span>Status</span>
        </div>
        <div className="card space-y-2 p-4 text-[14px]">
          <p>
            <span className="text-ink-faint">ログイン中：</span>
            <span className="font-bold">{email}</span>
          </p>
          <p>
            <span className="text-ink-faint">利用許可：</span>
            <span className="font-bold text-aqua-700">OK（allowed_users に登録済み）</span>
          </p>
          <p>
            <span className="text-ink-faint">データベース：</span>
            {firstError ? (
              <span className="font-bold text-alert">
                エラー：{firstError.message}（001_schema.sql・002_seed.sql を実行したか確認してください）
              </span>
            ) : (
              <span className="font-bold text-aqua-700">OK（RLS 経由で読み取りできています）</span>
            )}
          </p>
        </div>
      </section>

      <section>
        <div className="section-title">
          <h2>登録済みのマスタ</h2>
          <span>Masters</span>
        </div>
        <div className="space-y-2">
          <Accordion title="口座" summary={`${accounts.data?.length ?? 0}件`} defaultOpen>
            <ul className="divide-y divide-line-soft text-[14px]">
              {((accounts.data ?? []) as Account[]).map((a) => (
                <li key={a.id} className="flex items-center justify-between py-1.5">
                  <span>
                    {a.name}
                    <Inactive active={a.is_active} />
                  </span>
                  <span className="tag bg-aqua-50 text-aqua-700">{ACCOUNT_KIND_LABELS[a.kind]}</span>
                </li>
              ))}
            </ul>
          </Accordion>

          <Accordion title="種別" summary={`${types.data?.length ?? 0}件`}>
            <ul className="divide-y divide-line-soft text-[14px]">
              {((types.data ?? []) as TransactionType[]).map((t) => (
                <li key={t.id} className="flex items-center justify-between py-1.5">
                  <span>
                    {t.name}
                    <Inactive active={t.is_active} />
                  </span>
                  {t.code && <span className="font-en text-[11px] text-ink-faint">{t.code}</span>}
                </li>
              ))}
            </ul>
          </Accordion>

          <Accordion title="施設" summary={`${facilities.data?.length ?? 0}件`}>
            <ul className="divide-y divide-line-soft text-[14px]">
              {((facilities.data ?? []) as Facility[]).map((f) => (
                <li key={f.id} className="flex items-center justify-between py-1.5">
                  <span>
                    {f.name}
                    <Inactive active={f.is_active} />
                  </span>
                  <span className="tag bg-line-soft text-ink-soft">{PAYMENT_MODE_LABELS[f.payment_mode]}</span>
                </li>
              ))}
            </ul>
          </Accordion>

          <Accordion title="部員" summary={`${members.data?.length ?? 0}名`}>
            <ul className="flex flex-wrap gap-1.5 text-[13px]">
              {((members.data ?? []) as Member[]).map((m) => (
                <li key={m.id} className={`tag ${m.is_active ? 'bg-aqua-50 text-aqua-700' : 'bg-line-soft text-ink-faint'}`}>
                  {m.name}
                </li>
              ))}
            </ul>
          </Accordion>

          <Accordion title="利用を許可しているアカウント" summary={`${allowed.data?.length ?? 0}件`}>
            <ul className="divide-y divide-line-soft text-[14px]">
              {(allowed.data ?? []).map((u: { email: string; note: string | null }) => (
                <li key={u.email} className="flex items-center justify-between py-1.5">
                  <span className="break-all">{u.email}</span>
                  {u.note && <span className="text-[12px] text-ink-faint">{u.note}</span>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-ink-faint">追加は Supabase の SQL Editor から行います（README 参照）。</p>
          </Accordion>
        </div>
      </section>
    </div>
  );
}

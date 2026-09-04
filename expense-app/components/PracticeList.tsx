'use client';

import { useCallback, useEffect, useState } from 'react';
import ExpenseForm from '@/components/ExpenseForm';
import { EmptyBox, ErrorBox, Loading } from '@/components/StateBox';
import { fetchJson, toErrorMessage } from '@/lib/client';
import { formatDate, formatYen, shiftDateKey } from '@/lib/format';
import { SLOT_LABEL, type Expense, type Member, type Practice } from '@/lib/types';

// ============================================================
// 練習一覧
//   既存カレンダー（既存サイトと同じ Supabase の assignments）から
//   「日付」と「練習場所」だけを毎回取得して並べる。
//   練習予定はこのアプリの DB にコピーしない。
// ============================================================

/** 何日先まで表示するか */
const DAYS_AHEAD = 14;
/** 最初に何日前まで表示するか（ボタンで増やせる） */
const INITIAL_DAYS_BACK = 30;

type PracticeResponse = { practices: Practice[] };
type MembersResponse = { members: Member[] };
type ExpensesResponse = { expenses: Expense[] };

export default function PracticeList() {
  const [daysBack, setDaysBack] = useState(INITIAL_DAYS_BACK);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<Practice | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const from = shiftDateKey(-daysBack);
    const to = shiftDateKey(DAYS_AHEAD);

    try {
      // 練習一覧が出せることを最優先にするため、まず練習を取る
      const practiceRes = await fetchJson<PracticeResponse>(
        `/api/practices?from=${from}&to=${to}`,
      );
      setPractices(practiceRes.practices);

      // 部員マスタと立替の件数は「出れば嬉しい」情報なので、
      // 失敗しても練習一覧は消さずにそのまま表示する
      const [membersRes, expensesRes] = await Promise.allSettled([
        fetchJson<MembersResponse>('/api/members'),
        fetchJson<ExpensesResponse>(`/api/expenses?from=${from}&to=${to}`),
      ]);
      if (membersRes.status === 'fulfilled') setMembers(membersRes.value.members);
      if (expensesRes.status === 'fulfilled') setExpenses(expensesRes.value.expenses);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [daysBack]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleSaved(expense: Expense) {
    setExpenses((current) => [expense, ...current]);
    setTarget(null);
    setSaved(`${formatYen(expense.amount)} の立替を記録しました。`);
    // 少し経ったら通知を自然に消す
    setTimeout(() => setSaved(null), 4000);
  }

  // オフ（練習なし）の日は立替の対象にならないので出さない
  const rows = practices.filter((p) => !p.isOff);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold">練習一覧</h1>
        <span className="text-xs text-sub">
          {shiftDateKey(-daysBack)} 〜 {shiftDateKey(DAYS_AHEAD)}
        </span>
      </div>

      {saved && (
        <p className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm font-bold text-brandDark">
          {saved}
        </p>
      )}

      {error && <ErrorBox message={error} onRetry={() => void load()} />}
      {loading && practices.length === 0 && !error && <Loading label="練習予定を読み込んでいます…" />}

      {!loading && !error && rows.length === 0 && (
        <EmptyBox>この期間に練習の予定がありません。</EmptyBox>
      )}

      <ul className="space-y-2">
        {rows.map((practice) => {
          const related = expenses.filter((e) => e.assignment_id === practice.id);
          const total = related.reduce((sum, e) => sum + e.amount, 0);

          return (
            <li key={practice.id} className="card flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {formatDate(practice.date)}
                  {practice.slot !== 'all_day' && (
                    <span className="ml-1 text-sm font-normal text-sub">
                      {SLOT_LABEL[practice.slot]}
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-sub">{practice.location}</p>
                {related.length > 0 && (
                  <p className="mt-1 text-xs font-bold text-brandDark">
                    立替 {related.length}件 / {formatYen(total)}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="btn-primary shrink-0"
                onClick={() => setTarget(practice)}
              >
                立替を記録する
              </button>
            </li>
          );
        })}
      </ul>

      {!loading && !error && (
        <button
          type="button"
          className="btn-ghost w-full"
          onClick={() => setDaysBack((d) => d + 30)}
        >
          さらに30日前まで表示する
        </button>
      )}

      {target && (
        <ExpenseForm
          practice={target}
          members={members}
          onClose={() => setTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

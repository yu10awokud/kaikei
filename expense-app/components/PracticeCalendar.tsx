'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DaySheet from '@/components/DaySheet';
import ExpenseForm from '@/components/ExpenseForm';
import MonthCalendar from '@/components/MonthCalendar';
import { ErrorBox, Loading } from '@/components/StateBox';
import { fetchJson, toErrorMessage } from '@/lib/client';
import { addMonths, formatMonthTitle, monthRange, todayKey } from '@/lib/date';
import { formatYen } from '@/lib/format';
import type { Expense, Member, Practice } from '@/lib/types';

// ============================================================
// 練習タブ
//   既存サイトと同じ月表示カレンダーで練習を並べる。
//   練習予定はこのアプリの DB にコピーせず、月を切り替えるたびに
//   既存サイトと同じ Supabase を読みに行く。
// ============================================================

type PracticeResponse = { practices: Practice[] };
type MembersResponse = { members: Member[] };
type ExpensesResponse = { expenses: Expense[] };

/** 日付ごとにまとめ直す */
function groupByDate<T extends { event_date?: string; date?: string }>(items: T[]) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = item.date ?? item.event_date;
    if (!key) continue;
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}

export default function PracticeCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [practices, setPractices] = useState<Practice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [target, setTarget] = useState<Practice | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { start, end } = monthRange(year, month);

    try {
      // カレンダーが出せることを最優先にするため、まず練習を取る
      const practiceRes = await fetchJson<PracticeResponse>(
        `/api/practices?from=${start}&to=${end}`,
      );
      setPractices(practiceRes.practices);

      // 立替の金額と部員マスタは「出れば嬉しい」情報なので、
      // 失敗してもカレンダーは消さずにそのまま表示する
      const [expensesRes, membersRes] = await Promise.allSettled([
        fetchJson<ExpensesResponse>(`/api/expenses?from=${start}&to=${end}`),
        fetchJson<MembersResponse>('/api/members'),
      ]);
      if (expensesRes.status === 'fulfilled') setExpenses(expensesRes.value.expenses);
      if (membersRes.status === 'fulfilled') setMembers(membersRes.value.members);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const practicesByDate = useMemo(() => groupByDate(practices), [practices]);
  const expensesByDate = useMemo(() => groupByDate(expenses), [expenses]);

  function goMonth(diff: number) {
    const next = addMonths(year, month, diff);
    setYear(next.year);
    setMonth(next.month);
    setSelectedDate(null);
  }

  function goThisMonth() {
    const today = new Date();
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
    setSelectedDate(todayKey());
  }

  function handleSaved(expense: Expense) {
    setExpenses((current) => [expense, ...current]);
    setTarget(null);
    setSaved(`${formatYen(expense.amount)} の立替を記録しました。`);
    setTimeout(() => setSaved(null), 4000);
  }

  const monthTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div>
      {/* 月の切り替え */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-ink">
            {year}年{month}月
          </h1>
          <p className="font-en text-[10px] font-medium uppercase tracking-[0.16em] text-ink-faint">
            {formatMonthTitle(year, month)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" className="btn" onClick={() => goMonth(-1)} aria-label="前の月">
            ‹
          </button>
          <button type="button" className="btn" onClick={goThisMonth}>
            今月
          </button>
          <button type="button" className="btn" onClick={() => goMonth(1)} aria-label="次の月">
            ›
          </button>
        </div>
      </div>

      {saved && (
        <p className="mb-3 rounded-card border border-aqua-200 bg-aqua-50 px-3.5 py-2.5 text-[13px] font-bold text-aqua-700">
          {saved}
        </p>
      )}

      {error && (
        <div className="mb-3">
          <ErrorBox message={error} onRetry={() => void load()} />
        </div>
      )}

      {loading && practices.length === 0 && !error ? (
        <Loading label="練習予定を読み込んでいます…" />
      ) : (
        <MonthCalendar
          year={year}
          month={month}
          practicesByDate={practicesByDate}
          expensesByDate={expensesByDate}
          onSelectDate={setSelectedDate}
        />
      )}

      <p className="mt-3 text-center text-[13px] text-ink-soft">
        日付をタップすると、その日の立替を記録できます。
        {monthTotal > 0 && (
          <>
            <br />
            <span className="font-en font-bold text-ink">
              今月の立替 {formatYen(monthTotal)}
            </span>
          </>
        )}
      </p>

      {selectedDate && (
        <DaySheet
          dateKey={selectedDate}
          practices={practicesByDate.get(selectedDate) ?? []}
          expenses={expensesByDate.get(selectedDate) ?? []}
          onRecord={(practice) => setTarget(practice)}
          onClose={() => setSelectedDate(null)}
        />
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

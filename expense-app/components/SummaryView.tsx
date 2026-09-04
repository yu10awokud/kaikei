'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyBox, ErrorBox, Loading } from '@/components/StateBox';
import { fetchJson, toErrorMessage } from '@/lib/client';
import { shiftDateKey } from '@/lib/date';
import { formatYen } from '@/lib/format';
import { CATEGORY_LABEL, CATEGORY_ORDER, type Category, type Expense } from '@/lib/types';

// ============================================================
// 集計タブ
//   ・部員ごとの立替合計と、まだ返していない金額（未精算）
//   ・項目ごとの合計
//   ・CSV ダウンロード
//   金額はすべて整数（円）のまま足し算する。小数は使わない。
// ============================================================

type ExpensesResponse = { expenses: Expense[] };

type PayerRow = {
  key: string;
  name: string;
  total: number;
  unsettled: number;
  count: number;
};

export default function SummaryView({ active }: { active: boolean }) {
  const [from, setFrom] = useState(() => shiftDateKey(-90));
  const [to, setTo] = useState(() => shiftDateKey(14));

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryString = `from=${from}&to=${to}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<ExpensesResponse>(`/api/expenses?${queryString}`);
      setExpenses(res.expenses);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  // このタブを開いているときだけ読みに行く
  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  const { payerRows, categoryRows, total, unsettledTotal } = useMemo(() => {
    const byPayer = new Map<string, PayerRow>();
    const byCategory = new Map<Category, number>();
    let sum = 0;
    let unsettledSum = 0;

    for (const e of expenses) {
      // 部員マスタに無い人は名前をそのまま鍵にしてまとめる
      const key = e.payer_id ?? `name:${e.payer_name}`;
      const row = byPayer.get(key) ?? { key, name: e.payer_name, total: 0, unsettled: 0, count: 0 };
      row.total += e.amount;
      row.count += 1;
      // 「返金が必要」で「まだ精算していない」ものだけを未精算として数える
      if (e.needs_refund && e.status === 'unsettled') row.unsettled += e.amount;
      byPayer.set(key, row);

      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);

      sum += e.amount;
      if (e.needs_refund && e.status === 'unsettled') unsettledSum += e.amount;
    }

    return {
      // 未精算が多い順 → 合計が多い順に並べる
      payerRows: [...byPayer.values()].sort(
        (a, b) => b.unsettled - a.unsettled || b.total - a.total,
      ),
      categoryRows: CATEGORY_ORDER.map((key) => ({
        key,
        label: CATEGORY_LABEL[key],
        amount: byCategory.get(key) ?? 0,
      })).filter((row) => row.amount > 0),
      total: sum,
      unsettledTotal: unsettledSum,
    };
  }, [expenses]);

  return (
    <div>
      <div className="section-title">
        <h2>集計</h2>
        <span>Summary</span>
      </div>

      <div className="card mb-4 px-4 py-3.5">
        <span className="field-label">集計する期間</span>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="field"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="text-[13px] text-ink-faint">〜</span>
          <input
            type="date"
            className="field"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="mb-3">
          <ErrorBox message={error} onRetry={() => void load()} />
        </div>
      )}
      {loading && <Loading label="集計しています…" />}

      {!loading && !error && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="card px-4 py-3.5">
              <p className="text-[11px] font-medium text-ink-faint">立替の合計</p>
              <p className="font-en mt-1 text-xl font-bold text-ink">{formatYen(total)}</p>
            </div>
            <div className="card px-4 py-3.5">
              <p className="text-[11px] font-medium text-ink-faint">未精算の合計</p>
              <p className="font-en mt-1 text-xl font-bold text-alert">
                {formatYen(unsettledTotal)}
              </p>
            </div>
          </div>

          {expenses.length === 0 ? (
            <EmptyBox>この期間には立替の記録がありません。</EmptyBox>
          ) : (
            <>
              <section className="card mb-4 overflow-hidden">
                <h3 className="border-b border-line px-4 py-2.5 text-[13px] font-bold text-ink">
                  部員ごと
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-line text-left text-[11px] text-ink-faint">
                        <th className="px-4 py-2 font-medium">名前</th>
                        <th className="px-4 py-2 text-right font-medium">件数</th>
                        <th className="px-4 py-2 text-right font-medium">立替合計</th>
                        <th className="px-4 py-2 text-right font-medium">未精算</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payerRows.map((row) => (
                        <tr key={row.key} className="border-b border-line last:border-0">
                          <td className="px-4 py-2.5 font-bold text-ink">{row.name}</td>
                          <td className="font-en px-4 py-2.5 text-right text-ink-faint">
                            {row.count}
                          </td>
                          <td className="font-en px-4 py-2.5 text-right text-ink-soft">
                            {formatYen(row.total)}
                          </td>
                          <td
                            className={`font-en px-4 py-2.5 text-right font-bold ${
                              row.unsettled > 0 ? 'text-alert' : 'text-ink-faint'
                            }`}
                          >
                            {row.unsettled > 0 ? formatYen(row.unsettled) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="card mb-4 overflow-hidden">
                <h3 className="border-b border-line px-4 py-2.5 text-[13px] font-bold text-ink">
                  項目ごと
                </h3>
                <ul>
                  {categoryRows.map((row) => (
                    <li
                      key={row.key}
                      className="flex items-center justify-between border-b border-line px-4 py-2.5 text-[13px] last:border-0"
                    >
                      <span className="text-ink-soft">{row.label}</span>
                      <span className="font-en font-bold text-ink">{formatYen(row.amount)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}

          <a
            className="btn block w-full text-center"
            href={`/api/expenses/csv?${queryString}`}
          >
            この期間の立替を CSV でダウンロード
          </a>
          <p className="mt-2 text-[11px] text-ink-faint">
            CSV は Excel でそのまま開けます（文字化けしないようにしてあります）。
          </p>
        </>
      )}
    </div>
  );
}

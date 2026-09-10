'use client';

import { useCallback, useEffect, useState } from 'react';
import { ReceiptThumb, ReceiptViewer } from '@/components/ReceiptThumb';
import { EmptyBox, ErrorBox, Loading } from '@/components/StateBox';
import { fetchJson, toErrorMessage } from '@/lib/client';
import { formatDateWithWeekday } from '@/lib/date';
import { formatYen } from '@/lib/format';
import { SLOT_LABEL, categoryLabel, type Expense, type Payer } from '@/lib/types';

// ============================================================
// 立替一覧タブ
//   ・立て替えた人と、精算状況で絞り込める
//   ・領収書はサムネイル表示、タップで拡大
//   ・精算済みのチェックと、記録の取り消し（論理削除）ができる
// ============================================================

type ExpensesResponse = { expenses: Expense[]; receiptUrls: Record<string, string> };
type PayersResponse = { payers: Payer[] };

type StatusFilter = 'all' | 'unsettled' | 'settled';

const STATUS_TABS: [StatusFilter, string][] = [
  ['all', 'すべて'],
  ['unsettled', '未精算'],
  ['settled', '精算済み'],
];

export default function ExpenseList({ active }: { active: boolean }) {
  const [payer, setPayer] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string>>({});
  const [payers, setPayers] = useState<Payer[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const query = new URLSearchParams();
  if (payer) query.set('payer', payer);
  if (statusFilter !== 'all') query.set('status', statusFilter);
  const queryString = query.toString();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<ExpensesResponse>(`/api/expenses?${queryString}`);
      setExpenses(res.expenses);
      setReceiptUrls(res.receiptUrls);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  // このタブを開いているときだけ読みに行く。
  // （タブに戻ってくるたびに読み直すので、常に最新が出る）
  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  useEffect(() => {
    if (!active || payers.length > 0) return;
    fetchJson<PayersResponse>('/api/payers')
      .then((res) => setPayers(res.payers))
      .catch(() => setPayers([]));
  }, [active, payers.length]);

  async function toggleStatus(expense: Expense) {
    const next = expense.status === 'settled' ? 'unsettled' : 'settled';
    setBusyId(expense.id);
    setError(null);
    try {
      const res = await fetchJson<{ expense: Expense }>(`/api/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      setExpenses((current) => current.map((e) => (e.id === expense.id ? res.expense : e)));
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(expense: Expense) {
    const label = `${formatDateWithWeekday(expense.event_date)} ${expense.payer_name} ${formatYen(expense.amount)}`;
    if (!window.confirm(`この立替の記録を取り消します。よろしいですか？\n\n${label}`)) return;

    setBusyId(expense.id);
    setError(null);
    try {
      await fetchJson(`/api/expenses/${expense.id}`, { method: 'DELETE' });
      setExpenses((current) => current.filter((e) => e.id !== expense.id));
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div>
      <div className="section-title">
        <h2>立替一覧</h2>
        <span>Records</span>
      </div>

      {/* 絞り込み */}
      <div className="card mb-4 space-y-3 px-4 py-3.5">
        <div>
          <label className="field-label" htmlFor="payer-filter">
            立て替えた人
          </label>
          <select
            id="payer-filter"
            className="field"
            value={payer}
            onChange={(e) => setPayer(e.target.value)}
          >
            <option value="">全員</option>
            {payers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="field-label">精算状況</span>
          <div className="grid grid-cols-3 gap-2">
            {STATUS_TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`rounded-full border px-3 py-2 text-[13px] font-bold transition-colors ${
                  statusFilter === key
                    ? 'border-aqua-700 bg-aqua-700 text-white'
                    : 'border-line bg-white text-ink-soft active:bg-line-soft'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-[13px] text-ink-soft">
          {expenses.length}件 ／ 合計{' '}
          <span className="font-en font-bold text-ink">{formatYen(total)}</span>
        </p>
      </div>

      {error && (
        <div className="mb-3">
          <ErrorBox message={error} onRetry={() => void load()} />
        </div>
      )}
      {loading && <Loading label="立替を読み込んでいます…" />}
      {!loading && !error && expenses.length === 0 && (
        <EmptyBox>条件に合う立替の記録がありません。</EmptyBox>
      )}

      <ul className="space-y-2">
        {expenses.map((expense) => {
          const url = expense.receipt_path ? receiptUrls[expense.receipt_path] : undefined;
          const busy = busyId === expense.id;

          return (
            <li key={expense.id} className="card px-4 py-3.5">
              <div className="flex gap-3">
                {url ? (
                  <ReceiptThumb url={url} onOpen={() => setViewing(url)} />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-line text-[11px] text-ink-faint">
                    写真なし
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-bold text-ink">{expense.payer_name}</p>
                    <p className="font-en shrink-0 text-base font-bold text-ink">
                      {formatYen(expense.amount)}
                    </p>
                  </div>

                  <p className="truncate text-[13px] text-ink-soft">
                    {formatDateWithWeekday(expense.event_date)}
                    {expense.event_slot !== 'all_day' && ` ${SLOT_LABEL[expense.event_slot]}`}
                    {expense.event_location && ` ／ ${expense.event_location}`}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="tag bg-line-soft text-ink-soft">{categoryLabel(expense)}</span>
                    {expense.needs_refund ? (
                      expense.status === 'settled' ? (
                        <span className="tag bg-aqua-50 text-aqua-700">精算済み</span>
                      ) : (
                        <span className="tag bg-alert-soft text-alert">未精算</span>
                      )
                    ) : (
                      <span className="tag bg-line-soft text-ink-faint">返金不要</span>
                    )}
                  </div>

                  {expense.memo && (
                    <p className="mt-1 break-words text-[13px] text-ink-soft">{expense.memo}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                {expense.needs_refund && (
                  <button
                    type="button"
                    className="btn flex-1"
                    disabled={busy}
                    onClick={() => void toggleStatus(expense)}
                  >
                    {expense.status === 'settled' ? '未精算に戻す' : '精算済みにする'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn text-alert"
                  disabled={busy}
                  onClick={() => void remove(expense)}
                >
                  取り消す
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {viewing && <ReceiptViewer url={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

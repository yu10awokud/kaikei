'use client';

import { useCallback, useEffect, useState } from 'react';
import { ReceiptThumb, ReceiptViewer } from '@/components/ReceiptThumb';
import { EmptyBox, ErrorBox, Loading } from '@/components/StateBox';
import { fetchJson, toErrorMessage } from '@/lib/client';
import { formatDate, formatYen } from '@/lib/format';
import {
  SLOT_LABEL, categoryLabel,
  type Expense, type Member,
} from '@/lib/types';

// ============================================================
// 立替一覧
//   ・立て替えた人と、精算状況で絞り込める
//   ・領収書はサムネイル表示、タップで拡大
//   ・精算済みのチェックと、記録の取り消し（論理削除）ができる
// ============================================================

type ExpensesResponse = { expenses: Expense[]; receiptUrls: Record<string, string> };
type MembersResponse = { members: Member[] };

type StatusFilter = 'all' | 'unsettled' | 'settled';

export default function ExpenseList() {
  const [payer, setPayer] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string>>({});
  const [members, setMembers] = useState<Member[]>([]);

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

  useEffect(() => {
    void load();
  }, [load]);

  // 絞り込みの選択肢に使う部員マスタは一度だけ取れば十分
  useEffect(() => {
    fetchJson<MembersResponse>('/api/members')
      .then((res) => setMembers(res.members))
      .catch(() => setMembers([]));
  }, []);

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
      setExpenses((current) =>
        current.map((e) => (e.id === expense.id ? res.expense : e)),
      );
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(expense: Expense) {
    const label = `${formatDate(expense.event_date)} ${expense.payer_name} ${formatYen(expense.amount)}`;
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
    <div className="space-y-3">
      <h1 className="text-lg font-bold">立替一覧</h1>

      <div className="card space-y-2 px-4 py-3">
        <div>
          <label className="field-label" htmlFor="payer-filter">立て替えた人</label>
          <select
            id="payer-filter"
            className="field-input"
            value={payer}
            onChange={(e) => setPayer(e.target.value)}
          >
            <option value="">全員</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <span className="field-label">精算状況</span>
          <div className="grid grid-cols-3 gap-2">
            {([
              ['all', 'すべて'],
              ['unsettled', '未精算'],
              ['settled', '精算済み'],
            ] as [StatusFilter, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`btn ${
                  statusFilter === key
                    ? 'bg-brand text-white'
                    : 'border border-line bg-white text-ink hover:bg-bg'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="pt-1 text-sm text-sub">
          {expenses.length}件 / 合計 <span className="font-bold text-ink">{formatYen(total)}</span>
        </p>
      </div>

      {error && <ErrorBox message={error} onRetry={() => void load()} />}
      {loading && <Loading label="立替を読み込んでいます…" />}
      {!loading && !error && expenses.length === 0 && (
        <EmptyBox>条件に合う立替の記録がありません。</EmptyBox>
      )}

      <ul className="space-y-2">
        {expenses.map((expense) => {
          const url = expense.receipt_path ? receiptUrls[expense.receipt_path] : undefined;
          const busy = busyId === expense.id;

          return (
            <li key={expense.id} className="card px-4 py-3">
              <div className="flex gap-3">
                {url ? (
                  <ReceiptThumb url={url} onOpen={() => setViewing(url)} />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-line text-xs text-sub">
                    写真なし
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-bold">{expense.payer_name}</p>
                    <p className="shrink-0 text-base font-bold">{formatYen(expense.amount)}</p>
                  </div>

                  <p className="truncate text-sm text-sub">
                    {formatDate(expense.event_date)}
                    {expense.event_slot !== 'all_day' && ` ${SLOT_LABEL[expense.event_slot]}`}
                    {expense.event_location && ` / ${expense.event_location}`}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="badge bg-bg text-sub">{categoryLabel(expense)}</span>
                    {expense.needs_refund ? (
                      expense.status === 'settled' ? (
                        <span className="badge bg-green-100 text-green-800">精算済み</span>
                      ) : (
                        <span className="badge bg-amber-100 text-amber-800">未精算</span>
                      )
                    ) : (
                      <span className="badge bg-bg text-sub">返金不要</span>
                    )}
                  </div>

                  {expense.memo && (
                    <p className="mt-1 break-words text-sm text-sub">{expense.memo}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                {expense.needs_refund && (
                  <button
                    type="button"
                    className="btn-ghost flex-1"
                    disabled={busy}
                    onClick={() => void toggleStatus(expense)}
                  >
                    {expense.status === 'settled' ? '未精算に戻す' : '精算済みにする'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn-danger"
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

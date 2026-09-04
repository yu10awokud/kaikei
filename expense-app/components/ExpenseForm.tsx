'use client';

import { useState } from 'react';
import ReceiptPicker from '@/components/ReceiptPicker';
import { fetchJson, toErrorMessage } from '@/lib/client';
import { formatDateFull } from '@/lib/format';
import {
  CATEGORY_LABEL, CATEGORY_ORDER, SLOT_LABEL,
  type Category, type Expense, type Member, type Practice,
} from '@/lib/types';

// ============================================================
// 立替の入力フォーム（下から出てくるシート）
//   練習一覧の「立替を記録する」から開く。
// ============================================================

/** 部員マスタに無い人を入れるときに選ぶ、特別な値 */
const CUSTOM_PAYER = '__custom__';

export type ExpenseFormProps = {
  practice: Practice;
  members: Member[];
  onClose: () => void;
  onSaved: (expense: Expense) => void;
};

export default function ExpenseForm({ practice, members, onClose, onSaved }: ExpenseFormProps) {
  const [payerId, setPayerId] = useState('');
  const [customPayer, setCustomPayer] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('club_fee');
  const [categoryOther, setCategoryOther] = useState('');
  const [needsRefund, setNeedsRefund] = useState(true);
  const [memo, setMemo] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setError(null);

    try {
      const payerName =
        payerId === CUSTOM_PAYER
          ? customPayer.trim()
          : members.find((m) => m.id === payerId)?.name ?? '';

      if (!payerName) throw new Error('立て替えた人を選んでください。');

      // 写真があるときは、先に画像だけ送ってパスを受け取る
      let receiptPath: string | null = null;
      if (receipt) {
        const form = new FormData();
        form.append('file', receipt);
        const uploaded = await fetchJson<{ path: string }>('/api/receipts', {
          method: 'POST',
          body: form,
        });
        receiptPath = uploaded.path;
      }

      const saved = await fetchJson<{ expense: Expense }>('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: practice.id,
          event_date: practice.date,
          event_slot: practice.slot,
          event_location: practice.location,
          payer_id: payerId === CUSTOM_PAYER ? null : payerId,
          payer_name: payerName,
          amount,
          category,
          category_other: category === 'other' ? categoryOther : null,
          needs_refund: needsRefund,
          memo,
          receipt_path: receiptPath,
        }),
      });

      setReceipt(null);
      onSaved(saved.expense);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">立替を記録する</h2>
            <p className="mt-0.5 text-sm text-sub">
              {formatDateFull(practice.date)}
              {practice.slot !== 'all_day' && `（${SLOT_LABEL[practice.slot]}）`} ／{' '}
              {practice.location}
            </p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            閉じる
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="payer">立て替えた人</label>
            <select
              id="payer"
              className="field-input"
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              required
            >
              <option value="">選んでください</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
              <option value={CUSTOM_PAYER}>その他（名前を入力）</option>
            </select>
            {payerId === CUSTOM_PAYER && (
              <input
                type="text"
                className="field-input mt-2"
                placeholder="名前を入力してください"
                value={customPayer}
                onChange={(e) => setCustomPayer(e.target.value)}
                maxLength={40}
                required
              />
            )}
          </div>

          <div>
            <label className="field-label" htmlFor="amount">金額（円）</label>
            <input
              id="amount"
              type="text"
              // スマホで数字キーボードが出るようにする
              inputMode="numeric"
              pattern="[0-9]*"
              className="field-input"
              placeholder="例: 80"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-sub">1円単位の整数で入力してください。</p>
          </div>

          <div>
            <span className="field-label">項目</span>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_ORDER.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className={`btn ${
                    category === key
                      ? 'bg-brand text-white'
                      : 'border border-line bg-white text-ink hover:bg-bg'
                  }`}
                >
                  {CATEGORY_LABEL[key]}
                </button>
              ))}
            </div>
            {category === 'other' && (
              <input
                type="text"
                className="field-input mt-2"
                placeholder="項目の内容（例: 大会エントリー費）"
                value={categoryOther}
                onChange={(e) => setCategoryOther(e.target.value)}
                maxLength={60}
                required
              />
            )}
          </div>

          <div>
            <span className="field-label">返金の有無</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNeedsRefund(true)}
                className={`btn ${
                  needsRefund ? 'bg-brand text-white' : 'border border-line bg-white text-ink hover:bg-bg'
                }`}
              >
                必要
              </button>
              <button
                type="button"
                onClick={() => setNeedsRefund(false)}
                className={`btn ${
                  !needsRefund ? 'bg-brand text-white' : 'border border-line bg-white text-ink hover:bg-bg'
                }`}
              >
                不要
              </button>
            </div>
            <p className="mt-1 text-xs text-sub">
              {needsRefund
                ? '立て替えた人にお金を返す必要がある支出です。未精算として集計します。'
                : '部のお金からそのまま支払った支出です。未精算の集計には入れません。'}
            </p>
          </div>

          <div>
            <label className="field-label" htmlFor="memo">メモ（任意）</label>
            <input
              id="memo"
              type="text"
              className="field-input"
              placeholder="例: メニュー印刷代"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              maxLength={300}
            />
          </div>

          <ReceiptPicker file={receipt} onChange={setReceipt} />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-danger">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" className="btn-ghost flex-1" onClick={onClose} disabled={saving}>
              やめる
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? '保存しています…' : 'この内容で記録する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

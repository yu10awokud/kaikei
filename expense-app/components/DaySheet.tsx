'use client';

import { formatDateFull } from '@/lib/date';
import { formatYen } from '@/lib/format';
import { SLOT_LABEL, categoryLabel, type Expense, type Practice } from '@/lib/types';

// ============================================================
// カレンダーの日付をタップしたときに開くシート
//   その日の練習（場所）と、その日に記録済みの立替を並べる。
// ============================================================
export default function DaySheet({
  dateKey,
  practices,
  expenses,
  onRecord,
  onClose,
}: {
  dateKey: string;
  practices: Practice[];
  expenses: Expense[];
  onRecord: (practice: Practice) => void;
  onClose: () => void;
}) {
  // オフの日は立替の対象にならないので、記録の導線は出さない
  const active = practices.filter((p) => !p.isOff);
  const isOffDay = practices.length > 0 && active.length === 0;
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center">
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-card bg-white p-4 sm:rounded-card sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-bold text-ink">{formatDateFull(dateKey)}</h2>
          <button type="button" className="btn shrink-0" onClick={onClose}>
            閉じる
          </button>
        </div>

        {/* その日の練習 */}
        <section className="mb-5">
          <div className="section-title">
            <h2>練習</h2>
            <span>Practice</span>
          </div>

          {practices.length === 0 && (
            <p className="rounded-card border border-line bg-line-soft/40 px-4 py-5 text-center text-sm text-ink-faint">
              この日は練習の予定がありません。
            </p>
          )}

          {isOffDay && (
            <p className="rounded-card border border-line bg-line-soft/40 px-4 py-5 text-center text-sm text-ink-faint">
              この日はオフです。
            </p>
          )}

          <ul className="space-y-2">
            {active.map((practice) => (
              <li key={practice.id} className="card flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  {practice.slot !== 'all_day' && (
                    <p className="text-[11px] font-medium text-ink-faint">
                      {SLOT_LABEL[practice.slot]}
                    </p>
                  )}
                  <p
                    className="truncate text-sm font-bold"
                    style={{ color: practice.color }}
                  >
                    {practice.location}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-primary shrink-0"
                  onClick={() => onRecord(practice)}
                >
                  立替を記録
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* その日に記録済みの立替 */}
        <section>
          <div className="section-title">
            <h2>この日の立替</h2>
            <span>{expenses.length > 0 ? formatYen(total) : 'None'}</span>
          </div>

          {expenses.length === 0 ? (
            <p className="rounded-card border border-line bg-line-soft/40 px-4 py-5 text-center text-sm text-ink-faint">
              まだ記録がありません。
            </p>
          ) : (
            <ul className="space-y-2">
              {expenses.map((e) => (
                <li key={e.id} className="card px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-bold text-ink">{e.payer_name}</p>
                    <p className="font-en shrink-0 text-sm font-bold text-ink">
                      {formatYen(e.amount)}
                    </p>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    <span className="tag bg-line-soft text-ink-soft">{categoryLabel(e)}</span>
                    {e.needs_refund && e.status === 'unsettled' && (
                      <span className="tag bg-alert-soft text-alert">未精算</span>
                    )}
                    {!e.needs_refund && <span className="tag bg-line-soft text-ink-faint">返金不要</span>}
                  </div>
                  {e.memo && <p className="mt-1 break-words text-[13px] text-ink-soft">{e.memo}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

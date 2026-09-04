'use client';

import { buildCalendarCells, WEEKDAY_JA, todayKey } from '@/lib/date';
import { formatYen } from '@/lib/format';
import type { Expense, Practice } from '@/lib/types';

// ============================================================
// 月表示カレンダー（日曜始まり）— 既存サイトのカレンダーに合わせた見た目
//   ・各マスに「練習場所」を場所ごとの色で小さく出す
//     （担当者は出さない。このアプリでは取得もしていない）
//   ・その日に立替があれば、金額を青いタグで添える
// ============================================================
export default function MonthCalendar({
  year,
  month,
  practicesByDate,
  expensesByDate,
  onSelectDate,
}: {
  year: number;
  month: number;
  practicesByDate: Map<string, Practice[]>;
  expensesByDate: Map<string, Expense[]>;
  onSelectDate: (dateKey: string) => void;
}) {
  const cells = buildCalendarCells(year, month);
  const today = todayKey();

  return (
    <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
      {/* 曜日の見出し */}
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAY_JA.map((w, i) => (
          <div
            key={w}
            className={`py-2 text-center text-[11px] font-medium ${
              i === 0 ? 'text-rose-400' : i === 6 ? 'text-aqua-400' : 'text-ink-faint'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell, index) => {
          const practices = practicesByDate.get(cell.key) ?? [];
          const expenses = expensesByDate.get(cell.key) ?? [];
          const total = expenses.reduce((sum, e) => sum + e.amount, 0);
          const isToday = cell.key === today;

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelectDate(cell.key)}
              className={`
                min-h-[80px] p-1 text-left align-top transition-colors sm:min-h-[104px] sm:p-1.5
                ${cell.inMonth ? 'bg-white' : 'bg-line-soft/40'}
                ${index % 7 !== 6 ? 'border-r' : ''}
                ${index < 35 ? 'border-b' : ''}
                border-line active:bg-aqua-50
              `}
              aria-label={`${cell.key} の立替を見る`}
            >
              {/* 日付 */}
              <div className="mb-1 flex items-center justify-center sm:justify-start">
                <span
                  className={`font-en inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-semibold sm:text-xs ${
                    isToday
                      ? 'bg-aqua-600 text-white'
                      : !cell.inMonth
                        ? 'text-ink-faint/50'
                        : cell.weekday === 0
                          ? 'text-rose-400'
                          : cell.weekday === 6
                            ? 'text-aqua-500'
                            : 'text-ink-soft'
                  }`}
                >
                  {cell.day}
                </span>
              </div>

              {/* 練習場所（オフの日は灰色で「オフ」とだけ） */}
              <div className="space-y-0.5">
                {practices.map((p) =>
                  p.isOff ? (
                    <div
                      key={p.id}
                      className="rounded-md bg-line-soft px-1 py-[3px] text-center text-[10px] font-medium leading-tight text-ink-faint"
                    >
                      オフ
                    </div>
                  ) : (
                    <div key={p.id} className="px-0.5">
                      {/* 二部練のときは枠を別行に出す。
                          同じ行に並べると、狭いマスで場所名が消えてしまうため */}
                      {p.slot !== 'all_day' && (
                        <div className="text-[9px] font-medium leading-tight text-ink-faint">
                          {p.slot === 'am' ? '午前' : '午後'}
                        </div>
                      )}
                      <div
                        className="truncate text-[10px] font-medium leading-tight sm:text-[11px]"
                        style={{ color: p.color }}
                      >
                        {p.location}
                      </div>
                    </div>
                  ),
                )}
              </div>

              {/* その日の立替の合計 */}
              {total > 0 && (
                <div className="font-en mt-1 truncate rounded bg-aqua-50 px-1 py-[2px] text-[9px] font-semibold leading-tight text-aqua-700 sm:text-[10px]">
                  {formatYen(total)}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import AssignmentCard from '@/components/duty/AssignmentCard';
import { WEEKDAY_JA, buildCalendarCells, todayKey } from '@/lib/date';
import type { AssignmentView } from '@/lib/types';

// ============================================================
// 月表示カレンダー（日曜始まり）
//   ・スマホでも各マスに担当者名と場所名が入るよう、
//     マスの高さを十分に取り、文字を詰めすぎない
//   ・枠線は薄く、今日だけを青で示す
// ============================================================
export default function MonthCalendar({
  year,
  month,
  byDate,
  onSelectDate,
}: {
  year: number;
  month: number;
  byDate: Map<string, AssignmentView[]>;
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
          const items = byDate.get(cell.key) ?? [];
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
              aria-label={`${cell.key} の割り当てを編集`}
            >
              {/* 日付 */}
              <div className="mb-1 flex justify-center sm:justify-start">
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

              {/* 担当カード */}
              <div className="space-y-1">
                {items.map((a) => (
                  <AssignmentCard key={a.id} assignment={a} compact />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

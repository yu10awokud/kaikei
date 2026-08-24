'use client';

import AssignmentCard from '@/components/duty/AssignmentCard';
import { WEEKDAY_JA, buildCalendarCells, formatMonthTitle, todayKey } from '@/lib/date';
import type { AssignmentView } from '@/lib/types';

// 月表示カレンダー（日曜始まり・見出しは 'August 2026' 形式）
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
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line bg-cream">
        {WEEKDAY_JA.map((w, i) => (
          <div
            key={w}
            className={`py-1.5 text-center text-[11px] font-bold ${
              i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-neutral-600'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const items = byDate.get(cell.key) ?? [];
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelectDate(cell.key)}
              className={`min-h-[68px] border-b border-r border-line p-0.5 text-left align-top tap sm:min-h-[92px] sm:p-1 ${
                cell.inMonth ? 'bg-white' : 'bg-neutral-50'
              }`}
              aria-label={`${cell.key} の割り当てを編集`}
            >
              <div
                className={`mb-0.5 px-0.5 text-[10px] sm:text-xs ${
                  !cell.inMonth
                    ? 'text-neutral-300'
                    : cell.key === today
                      ? 'inline-block rounded-full bg-ink px-1.5 font-bold text-white'
                      : cell.weekday === 0
                        ? 'text-red-600'
                        : cell.weekday === 6
                          ? 'text-blue-600'
                          : 'text-neutral-600'
                }`}
              >
                {cell.day}
              </div>

              <div className="space-y-0.5">
                {items.map((a) => (
                  <AssignmentCard key={a.id} assignment={a} compact />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="px-3 py-2 text-center text-[11px] text-neutral-400">
        {formatMonthTitle(year, month)}　／　日付をタップすると編集できます
      </div>
    </div>
  );
}

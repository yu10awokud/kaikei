'use client';

import { formatDateWithWeekday, todayKey } from '@/lib/date';
import type { AssignmentView } from '@/lib/types';

// ============================================================
// 次回の練習
//   今日を含む「これから一番近い練習日」を大きく見せる。
//   オフの日は飛ばして、実際に練習がある日を出す。
// ============================================================
export default function NextPractice({
  assignments,
  onSelectDate,
}: {
  assignments: AssignmentView[];
  onSelectDate: (dateKey: string) => void;
}) {
  const today = todayKey();

  // 今日以降で、オフではない登録があるいちばん近い日を探す
  const upcoming = assignments
    .filter((a) => a.date >= today && !a.place?.is_off)
    .sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));

  const nextDate = upcoming[0]?.date;
  const items = nextDate ? upcoming.filter((a) => a.date === nextDate) : [];

  return (
    <section id="next" className="scroll-mt-4">
      <div className="mb-2.5 flex items-baseline gap-2">
        <h2 className="text-[15px] font-bold tracking-wide text-ink">次回の練習</h2>
        <span className="font-en text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
          Next
        </span>
      </div>

      {!nextDate ? (
        <div className="rounded-card border border-line bg-line-soft/50 px-4 py-6 text-center">
          <p className="text-sm text-ink-faint">これからの練習予定はまだ登録されていません</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onSelectDate(nextDate)}
          className="w-full rounded-card bg-aqua-600 px-5 py-5 text-left text-white transition-opacity active:opacity-90"
        >
          {/* 日付 */}
          <div className="flex items-baseline gap-2">
            <span className="font-en text-2xl font-semibold tracking-tight">
              {formatDateWithWeekday(nextDate)}
            </span>
            {nextDate === today && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium">
                今日
              </span>
            )}
          </div>

          {/* 担当者と練習場所 */}
          <div className="mt-4 space-y-3">
            {items.map((a) => (
              <div key={a.id} className="flex items-baseline gap-3">
                {a.slot !== 'all_day' && (
                  <span className="w-8 shrink-0 text-xs font-medium text-white/70">
                    {a.slot === 'am' ? '午前' : '午後'}
                  </span>
                )}

                <div className="min-w-0">
                  <div className="truncate text-xl font-bold leading-tight">
                    {a.member ? a.member.name : '未定'}
                  </div>
                  {a.place && (
                    <div className="mt-0.5 truncate text-[13px] font-medium text-white/80">
                      {a.place.name}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </button>
      )}
    </section>
  );
}

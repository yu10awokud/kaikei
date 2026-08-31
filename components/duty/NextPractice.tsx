'use client';

import { formatDateWithWeekday, todayKey } from '@/lib/date';
import { displayMemberName, type AssignmentView } from '@/lib/types';

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
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-bold text-ink">次回の練習</h2>
        <span className="font-en text-[10px] font-medium uppercase tracking-[0.16em] text-ink-faint">
          Next
        </span>
      </div>

      {!nextDate ? (
        <div className="rounded-card border border-line bg-line-soft/50 px-4 py-7 text-center">
          <p className="text-sm text-ink-faint">これからの練習予定はまだ登録されていません</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onSelectDate(nextDate)}
          className="relative w-full overflow-hidden rounded-card px-5 py-5 text-left text-white transition-opacity active:opacity-95"
          style={{
            // 単色ではなく、水面のような深さのある青
            background: 'linear-gradient(140deg, #1F6FAF 0%, #175E97 45%, #124E80 100%)',
          }}
        >
          {/* 背景の波（控えめに重ねる） */}
          <svg
            aria-hidden
            viewBox="0 0 400 160"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-[0.18]"
          >
            <path d="M0 96 C 70 62, 130 122, 200 92 S 330 58, 400 88 L400 160 L0 160 Z" fill="#ffffff" />
            <path d="M0 118 C 80 92, 140 140, 210 116 S 340 88, 400 112 L400 160 L0 160 Z" fill="#ffffff" opacity="0.6" />
          </svg>

          <div className="relative">
            {/* 日付 */}
            <div className="flex items-baseline gap-2.5">
              <span className="font-en text-[32px] font-semibold leading-none tracking-tight">
                {formatDateWithWeekday(nextDate).replace(/（.+）/, '')}
              </span>
              <span className="text-base font-medium text-white/85">
                {formatDateWithWeekday(nextDate).match(/（(.+)）/)?.[1]}
              </span>
              {nextDate === today && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium">
                  今日
                </span>
              )}
            </div>

            {/* 担当者と練習場所 */}
            <div className="mt-5 space-y-4">
              {items.map((a) => (
                <div key={a.id}>
                  {a.slot !== 'all_day' && (
                    <div className="mb-1 text-[11px] font-medium text-white/70">
                      {a.slot === 'am' ? '午前' : '午後'}
                    </div>
                  )}

                  <div className="text-[11px] font-medium tracking-wide text-white/70">担当者</div>
                  <div className="mt-0.5 truncate text-2xl font-bold leading-tight">
                    {displayMemberName(a)}
                  </div>

                  {a.place && (
                    <>
                      <div className="mt-3 text-[11px] font-medium tracking-wide text-white/70">
                        場所
                      </div>
                      <div className="mt-1">
                        <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[13px] font-medium">
                          {a.place.name}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </button>
      )}
    </section>
  );
}

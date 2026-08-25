'use client';

import { addDays, formatDateWithWeekday, todayKey } from '@/lib/date';
import type { AssignmentView } from '@/lib/types';

// ============================================================
// 直近1週間の担当一覧
//   カレンダーの補助として、今日から7日ぶんの担当者と練習場所を並べる。
//   カレンダーが主役なので、こちらは控えめな見た目にする。
// ============================================================
export default function UpcomingList({
  byDate,
  onSelectDate,
}: {
  byDate: Map<string, AssignmentView[]>;
  onSelectDate: (dateKey: string) => void;
}) {
  const start = todayKey();

  // 今日から7日ぶんのうち、登録がある日だけを拾う
  const days: { key: string; items: AssignmentView[] }[] = [];
  for (let i = 0; i < 7; i++) {
    const key = addDays(start, i);
    const items = byDate.get(key);
    if (items && items.length > 0) days.push({ key, items });
  }

  return (
    <div className="rounded-card border border-line bg-white p-3.5 shadow-card">
      <div className="mb-2.5 flex items-baseline gap-2">
        <h3 className="text-[13px] font-bold text-ink">直近1週間</h3>
        <span className="font-en text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint">
          Next 7 days
        </span>
      </div>

      {days.length === 0 ? (
        <p className="py-4 text-center text-xs text-ink-faint">
          この1週間の登録はまだありません
        </p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {days.map(({ key, items }) => (
            <li key={key}>
              <button
                type="button"
                onClick={() => onSelectDate(key)}
                className="w-full py-2 text-left tap"
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className={`font-en text-xs font-semibold ${
                      key === start ? 'text-aqua-600' : 'text-ink-soft'
                    }`}
                  >
                    {formatDateWithWeekday(key)}
                  </span>
                  {key === start && (
                    <span className="rounded-full bg-aqua-50 px-1.5 py-px text-[10px] font-medium text-aqua-600">
                      今日
                    </span>
                  )}
                </div>

                <div className="mt-1 space-y-1">
                  {items.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      {a.slot !== 'all_day' && (
                        <span className="text-[10px] font-medium text-ink-faint">
                          {a.slot === 'am' ? '午前' : '午後'}
                        </span>
                      )}

                      {a.place?.is_off ? (
                        <span className="text-xs font-medium text-ink-faint">オフ</span>
                      ) : (
                        <>
                          <span
                            className={`text-sm font-bold ${
                              a.member ? 'text-ink' : 'font-medium text-ink-faint'
                            }`}
                          >
                            {a.member ? a.member.name : '未定'}
                          </span>
                          {a.place && (
                            <span
                              className="text-[11px] font-medium"
                              style={{ color: a.place.color }}
                            >
                              {a.place.name}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

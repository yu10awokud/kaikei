'use client';

import { formatDateWithWeekday, todayKey } from '@/lib/date';
import type { AssignmentView } from '@/lib/types';

// リスト表示：「日付（曜日）／担当者／場所」を日付順に並べる
// スマホでは月表示が潰れるため、こちらを既定にする
export default function DutyList({
  dates,
  byDate,
  onSelectDate,
}: {
  dates: string[];
  byDate: Map<string, AssignmentView[]>;
  onSelectDate: (dateKey: string) => void;
}) {
  const today = todayKey();

  if (dates.length === 0) {
    return (
      <div className="card px-4 py-8 text-center text-sm text-neutral-500">
        この月にはまだ登録がありません。
        <br />
        「カレンダー」表示に切り替えて、日付をタップすると登録できます。
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {dates.map((dateKey) => {
        const items = byDate.get(dateKey) ?? [];
        return (
          <li key={dateKey}>
            <button
              type="button"
              onClick={() => onSelectDate(dateKey)}
              className="card w-full px-3 py-2.5 text-left tap"
            >
              <div className="flex items-baseline gap-2">
                <span className={`text-sm font-bold ${dateKey === today ? 'text-blue-700' : ''}`}>
                  {formatDateWithWeekday(dateKey)}
                </span>
                {dateKey === today && <span className="text-[10px] text-blue-700">今日</span>}
              </div>

              <div className="mt-1.5 space-y-1.5">
                {items.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {a.slot !== 'all_day' && (
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
                        {a.slot === 'am' ? '午前' : '午後'}
                      </span>
                    )}
                    <span
                      className={`text-sm font-bold ${a.member ? '' : 'font-normal text-neutral-400'}`}
                      style={a.member ? { color: a.member.color } : undefined}
                    >
                      {a.member ? a.member.name : '未定'}
                    </span>
                    {a.place && (
                      <span
                        className="tag"
                        style={{
                          borderColor: a.place.color,
                          color: a.place.color,
                          backgroundColor: `${a.place.color}14`,
                        }}
                      >
                        {a.place.name}
                      </span>
                    )}
                    {a.note && <span className="text-xs text-neutral-500">{a.note}</span>}
                  </div>
                ))}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

'use client';

import { useMemo, useState } from 'react';
import SectionHeader from '@/components/SectionHeader';
import AssignmentSheet from '@/components/duty/AssignmentSheet';
import MonthCalendar from '@/components/duty/MonthCalendar';
import RatioChart from '@/components/duty/RatioChart';
import { addMonths, formatMonthTitle } from '@/lib/date';
import { getCurrentSeasonKey } from '@/lib/season';
import { summarizeAllSeasons } from '@/lib/stats';
import type { AssignmentView, Member, Place } from '@/lib/types';

// ③ メニュー担当：「担当日」「担当率」の 2 タブ
export default function DutySection({
  initialAssignments,
  members,
  places,
  configured,
}: {
  initialAssignments: AssignmentView[];
  members: Member[];
  places: Place[];
  configured: boolean;
}) {
  const [assignments, setAssignments] = useState<AssignmentView[]>(initialAssignments);
  const [tab, setTab] = useState<'days' | 'ratio'>('days');
  const [openDate, setOpenDate] = useState<string | null>(null);

  const today = new Date();
  const [ym, setYm] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });

  // 日付ごとにまとめる（カレンダー表示で使う）
  const byDate = useMemo(() => {
    const map = new Map<string, AssignmentView[]>();
    const order = { all_day: 0, am: 1, pm: 2 } as const;
    for (const a of assignments) {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    }
    for (const list of map.values()) list.sort((x, y) => order[x.slot] - order[y.slot]);
    return map;
  }, [assignments]);

  // 担当率（シーズンごと）
  const seasons = useMemo(() => summarizeAllSeasons(assignments), [assignments]);
  const currentSeasonKey = getCurrentSeasonKey();
  const currentSeason = seasons.find((s) => s.season === currentSeasonKey) ?? seasons[0];
  const pastSeasons = seasons.filter((s) => s.season !== currentSeason?.season);

  /** モーダルで保存されたら、その日のぶんだけ差し替える（再読み込みなしで反映） */
  function handleSaved(dateKey: string, saved: AssignmentView[]) {
    setAssignments((prev) => [...prev.filter((a) => a.date !== dateKey), ...saved]);
  }

  /** 「毎週まとめて登録」で増えたぶんを足す */
  function handleBulkAdded(added: AssignmentView[]) {
    if (added.length === 0) return;
    setAssignments((prev) => {
      const ids = new Set(added.map((a) => a.id));
      return [...prev.filter((a) => !ids.has(a.id)), ...added];
    });
  }

  const activeMembers = members.filter((m) => m.is_active);
  const activePlaces = places.filter((p) => p.is_active);

  return (
    <section id="duty">
      <SectionHeader emoji="🏊" title="メニュー担当" />

      {!configured && (
        <p className="mb-3 rounded-card border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Supabase の環境変数が未設定のため、データを読み込めていません（.env.local を確認してください）。
        </p>
      )}

      {/* タブ */}
      <div className="mb-3 flex gap-1 rounded-card bg-neutral-100 p-1">
        <TabButton active={tab === 'days'} onClick={() => setTab('days')}>
          担当日
        </TabButton>
        <TabButton active={tab === 'ratio'} onClick={() => setTab('ratio')}>
          担当率
        </TabButton>
      </div>

      {tab === 'days' ? (
        <div>
          {/* 月の移動 ＋ 表示切替 */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn px-2.5"
                onClick={() => setYm(addMonths(ym.year, ym.month, -1))}
                aria-label="前の月"
              >
                ‹
              </button>
              <span className="min-w-[132px] text-center text-sm font-bold">
                {formatMonthTitle(ym.year, ym.month)}
              </span>
              <button
                type="button"
                className="btn px-2.5"
                onClick={() => setYm(addMonths(ym.year, ym.month, 1))}
                aria-label="次の月"
              >
                ›
              </button>
              <button
                type="button"
                className="btn ml-1 text-xs"
                onClick={() => setYm({ year: today.getFullYear(), month: today.getMonth() + 1 })}
              >
                Today
              </button>
            </div>
          </div>

          <MonthCalendar year={ym.year} month={ym.month} byDate={byDate} onSelectDate={setOpenDate} />
        </div>
      ) : (
        currentSeason && <RatioChart current={currentSeason} past={pastSeasons} />
      )}

      {openDate && (
        <AssignmentSheet
          dateKey={openDate}
          assignments={byDate.get(openDate) ?? []}
          members={activeMembers}
          places={activePlaces}
          onClose={() => setOpenDate(null)}
          onSaved={handleSaved}
          onBulkAdded={handleBulkAdded}
        />
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
  small = false,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-[7px] text-center font-bold transition-colors ${
        small ? 'px-2.5 py-1 text-xs' : 'px-3 py-2 text-sm'
      } ${active ? 'bg-white shadow-sm' : 'text-neutral-500'}`}
    >
      {children}
    </button>
  );
}

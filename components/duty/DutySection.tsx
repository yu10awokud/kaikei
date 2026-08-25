'use client';

import { useMemo, useState } from 'react';
import SectionHeader from '@/components/SectionHeader';
import AssignmentSheet from '@/components/duty/AssignmentSheet';
import MonthCalendar from '@/components/duty/MonthCalendar';
import NextPractice from '@/components/duty/NextPractice';
import UpcomingList from '@/components/duty/UpcomingList';
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
      {/* 次回の練習を一番上に */}
      <div className="mb-8">
        <NextPractice assignments={assignments} onSelectDate={setOpenDate} />
      </div>

      <SectionHeader title="メニュー担当" en="Assignments" />

      {!configured && (
        <p className="mb-3 rounded-card border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Supabase の環境変数が未設定のため、データを読み込めていません（.env.local を確認してください）。
        </p>
      )}

      {/* タブ */}
      <div className="mb-4 inline-flex gap-1 rounded-full bg-line-soft p-1">
        <TabButton active={tab === 'days'} onClick={() => setTab('days')}>
          担当日
        </TabButton>
        <TabButton active={tab === 'ratio'} onClick={() => setTab('ratio')}>
          担当率
        </TabButton>
      </div>

      {tab === 'days' ? (
        <div>
          {/* 月の移動 */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-en text-xl font-semibold tracking-tight sm:text-2xl">
              {formatMonthTitle(ym.year, ym.month)}
            </h3>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-soft tap"
                onClick={() => setYm(addMonths(ym.year, ym.month, -1))}
                aria-label="前の月"
              >
                ‹
              </button>
              <button
                type="button"
                className="btn font-en"
                onClick={() => setYm({ year: today.getFullYear(), month: today.getMonth() + 1 })}
              >
                Today
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-soft tap"
                onClick={() => setYm(addMonths(ym.year, ym.month, 1))}
                aria-label="次の月"
              >
                ›
              </button>
            </div>
          </div>

          {/* カレンダーが主役。その下に直近1週間を並べる（PC でも縦積み） */}
          <div className="space-y-3">
            <MonthCalendar year={ym.year} month={ym.month} byDate={byDate} onSelectDate={setOpenDate} />
            <UpcomingList byDate={byDate} onSelectDate={setOpenDate} />
          </div>
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
      className={`rounded-full text-center font-bold transition-colors ${
        small ? 'px-3 py-1 text-xs' : 'px-5 py-1.5 text-sm'
      } ${active ? 'bg-white text-ink shadow-card' : 'text-ink-faint'}`}
    >
      {children}
    </button>
  );
}

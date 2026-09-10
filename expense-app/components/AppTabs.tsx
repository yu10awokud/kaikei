'use client';

import { useEffect, useState } from 'react';
import ExpenseList from '@/components/ExpenseList';
import PracticeCalendar from '@/components/PracticeCalendar';
import SummaryView from '@/components/SummaryView';

// ============================================================
// 画面上部のタブ（練習 / 立替一覧 / 集計）
//   既存サイトのタブと同じ、丸いボタンの並びにそろえる。
// ============================================================

type Tab = 'practice' | 'expenses' | 'summary';

const TABS: { key: Tab; label: string }[] = [
  { key: 'practice', label: '練習' },
  { key: 'expenses', label: '立替一覧' },
  { key: 'summary', label: '集計' },
];

function isTab(value: string | null): value is Tab {
  return TABS.some((t) => t.key === value);
}

export default function AppTabs() {
  const [tab, setTab] = useState<Tab>('practice');

  // '?tab=summary' のように指定されていれば、そのタブを開いた状態で始める。
  // （以前の /summary などのURLは、ここへ転送される）
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (isTab(requested)) setTab(requested);
  }, []);

  /** タブを切り替えたら、URL も合わせておく（再読み込みしても同じタブに戻る） */
  function selectTab(next: Tab) {
    setTab(next);
    const url = next === 'practice' ? '/' : `/?tab=${next}`;
    window.history.replaceState(null, '', url);
  }

  return (
    <div>
      <div className="mb-8 grid grid-cols-3 gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => selectTab(item.key)}
            className={`rounded-full border px-4 py-2.5 text-sm font-bold transition-colors ${
              tab === item.key
                ? 'border-aqua-700 bg-aqua-700 text-white'
                : 'border-line bg-white text-ink-soft active:bg-line-soft'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/*
        タブを切り替えても入力途中の内容が消えないよう、
        画面ごと作り直さずに表示だけ切り替える。
      */}
      <div hidden={tab !== 'practice'}>
        <PracticeCalendar />
      </div>
      <div hidden={tab !== 'expenses'}>
        <ExpenseList active={tab === 'expenses'} />
      </div>
      <div hidden={tab !== 'summary'}>
        <SummaryView active={tab === 'summary'} />
      </div>
    </div>
  );
}

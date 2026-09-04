'use client';

import { useState } from 'react';
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

export default function AppTabs() {
  const [tab, setTab] = useState<Tab>('practice');

  return (
    <div>
      <div className="mb-8 grid grid-cols-3 gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
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

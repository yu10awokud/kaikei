'use client';

import { useState } from 'react';

// ============================================================
// トップページのタブ（ホーム / マニュアル）
//   サーバー側で組み立てた中身を受け取って切り替えるだけにする。
// ============================================================
export default function HomeTabs({
  home,
  manual,
  notice,
}: {
  home: React.ReactNode;
  manual: React.ReactNode;
  /** タブの下に出すお知らせ（無ければ何も出ない） */
  notice?: React.ReactNode;
}) {
  const [tab, setTab] = useState<'home' | 'manual'>('home');

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <TabButton active={tab === 'home'} onClick={() => setTab('home')}>
          ホーム
        </TabButton>
        <TabButton active={tab === 'manual'} onClick={() => setTab('manual')}>
          マニュアル
        </TabButton>
      </div>

      {notice ? <div className="mb-8">{notice}</div> : <div className="mb-8" />}

      {tab === 'home' ? home : manual}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2.5 text-sm font-bold transition-colors ${
        active
          ? 'border-aqua-700 bg-aqua-700 text-white'
          : 'border-line bg-white text-ink-soft active:bg-line-soft'
      }`}
    >
      {children}
    </button>
  );
}

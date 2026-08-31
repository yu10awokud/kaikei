'use client';

import { useMemo, useState } from 'react';
import { formatDateWithWeekday } from '@/lib/date';
import {
  displayMemberName,
  hasMember,
  type AssignmentView,
  type Member,
  type MenuFileView,
  type Place,
} from '@/lib/types';

// ============================================================
// メニューPDF アーカイブ
//   アップロード済みの PDF を新しい順に並べ、
//   担当者・練習場所で絞り込めるようにする。
// ============================================================

/** 12345 → '12.1 KB' */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

/** 「その他」で自由記述した担当者をまとめる時のキー */
const OTHER = '__other__';

export default function MenuArchive({
  files,
  assignments,
  members,
  places,
}: {
  files: MenuFileView[];
  assignments: AssignmentView[];
  members: Member[];
  places: Place[];
}) {
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [placeFilter, setPlaceFilter] = useState<string>('all');

  // 日付ごとの担当情報（1 日に複数件＝二部練もある）
  const byDate = useMemo(() => {
    const map = new Map<string, AssignmentView[]>();
    for (const a of assignments) {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    }
    return map;
  }, [assignments]);

  // 実際に PDF がある日付だけに絞って、選択肢を作る
  const { memberOptions, placeOptions } = useMemo(() => {
    const memberIds = new Set<string>();
    const placeIds = new Set<string>();
    let hasOther = false;

    for (const f of files) {
      for (const a of byDate.get(f.date) ?? []) {
        if (a.member_id) memberIds.add(a.member_id);
        else if (a.custom_member) hasOther = true;
        if (a.place_id) placeIds.add(a.place_id);
      }
    }

    const memberOptions = members
      .filter((m) => memberIds.has(m.id))
      .map((m) => ({ id: m.id, name: m.name }));
    if (hasOther) memberOptions.push({ id: OTHER, name: 'その他' });

    return {
      memberOptions,
      placeOptions: places.filter((p) => placeIds.has(p.id)).map((p) => ({ id: p.id, name: p.name })),
    };
  }, [files, byDate, members, places]);

  // 絞り込み（PDF の日付の担当情報のどれかが条件に合えば表示）
  const shown = useMemo(() => {
    return files.filter((f) => {
      const items = byDate.get(f.date) ?? [];

      if (memberFilter !== 'all') {
        const hit = items.some((a) =>
          memberFilter === OTHER ? Boolean(a.custom_member) : a.member_id === memberFilter
        );
        if (!hit) return false;
      }

      if (placeFilter !== 'all') {
        if (!items.some((a) => a.place_id === placeFilter)) return false;
      }

      return true;
    });
  }, [files, byDate, memberFilter, placeFilter]);

  return (
    <div>
      {/* 絞り込み */}
      <div className="space-y-3 rounded-card border border-line bg-line-soft/50 p-3.5">
        <FilterRow
          label="担当者"
          options={memberOptions}
          value={memberFilter}
          onChange={setMemberFilter}
        />
        <FilterRow
          label="練習場所"
          options={placeOptions}
          value={placeFilter}
          onChange={setPlaceFilter}
        />
      </div>

      {/* 件数 */}
      <p className="mt-4 px-1 text-xs text-ink-faint">
        <span className="font-en font-semibold text-ink-soft">{shown.length}</span> 件
        {(memberFilter !== 'all' || placeFilter !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setMemberFilter('all');
              setPlaceFilter('all');
            }}
            className="ml-2 underline underline-offset-2"
          >
            絞り込みを解除
          </button>
        )}
      </p>

      {/* 一覧（新しい順） */}
      {shown.length === 0 ? (
        <p className="mt-3 rounded-card border border-line bg-white px-4 py-10 text-center text-sm text-ink-faint">
          {files.length === 0
            ? 'まだメニューPDFがアップロードされていません'
            : '条件に合うメニューがありません'}
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {shown.map((f) => {
            const items = byDate.get(f.date) ?? [];
            return (
              <li key={f.id}>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card block p-4 tap"
                >
                  {/* 日付 */}
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-en text-base font-semibold tracking-tight text-ink">
                      {f.date.replaceAll('-', '.')}
                    </span>
                    <span className="text-[11px] text-ink-faint">
                      {formatDateWithWeekday(f.date)}
                    </span>
                  </div>

                  {/* その日の担当者と練習場所 */}
                  {items.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {items.map((a) => (
                        <span key={a.id} className="flex items-baseline gap-1.5">
                          {a.slot !== 'all_day' && (
                            <span className="text-[10px] text-ink-faint">
                              {a.slot === 'am' ? '午前' : '午後'}
                            </span>
                          )}
                          <span
                            className={`text-sm font-bold ${
                              hasMember(a) ? 'text-ink' : 'font-medium text-ink-faint'
                            }`}
                          >
                            {displayMemberName(a)}
                          </span>
                          {a.place && (
                            <span
                              className="text-[11px] font-medium"
                              style={{ color: a.place.color }}
                            >
                              {a.place.name}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* ファイル */}
                  <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-aqua-600 underline underline-offset-2">
                        {f.file_name}
                      </span>
                      <span className="font-en block text-[11px] text-ink-faint">
                        {formatSize(f.size_bytes)}
                      </span>
                    </span>
                    <span aria-hidden className="shrink-0 text-xs text-ink-faint">
                      ↗
                    </span>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// 絞り込みの 1 行（横スクロールできるボタン列）
// ------------------------------------------------------------
function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; name: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-medium text-ink-faint">{label}</div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        <Chip active={value === 'all'} onClick={() => onChange('all')}>
          すべて
        </Chip>
        {options.map((o) => (
          <Chip key={o.id} active={value === o.id} onClick={() => onChange(o.id)}>
            {o.name}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
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
      className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
        active
          ? 'border-aqua-700 bg-aqua-700 text-white'
          : 'border-line bg-white text-ink-soft active:bg-line-soft'
      }`}
    >
      {children}
    </button>
  );
}

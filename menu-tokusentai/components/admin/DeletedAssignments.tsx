'use client';

import { useState } from 'react';
import { formatDateWithWeekday } from '@/lib/date';
import { SLOT_LABEL, type AssignmentView } from '@/lib/types';

// 管理画面：論理削除された割り当ての一覧と復元
export default function DeletedAssignments({ initialItems }: { initialItems: AssignmentView[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restore(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/assignments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_deleted: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '復元に失敗しました。');
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : '復元に失敗しました。');
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return <p className="card px-3 py-6 text-center text-sm text-neutral-500">削除された割り当てはありません。</p>;
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.id} className="card flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-sm font-bold">
                {formatDateWithWeekday(a.date)}
                <span className="ml-2 text-xs font-normal text-neutral-500">{SLOT_LABEL[a.slot]}</span>
              </div>
              <div className="truncate text-xs text-neutral-600">
                {a.member?.name ?? '未定'}
                {a.place ? ` ／ ${a.place.name}` : ''}
                {a.note ? ` ／ ${a.note}` : ''}
              </div>
            </div>
            <button
              type="button"
              className="btn shrink-0 text-xs"
              disabled={busyId === a.id}
              onClick={() => restore(a.id)}
            >
              {busyId === a.id ? '復元中…' : '復元'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { formatDateWithWeekday } from '@/lib/date';
import type { MenuFileView } from '@/lib/types';

// 管理画面：削除したメニューPDFの一覧と復元
export default function DeletedMenuFiles({ initialItems }: { initialItems: MenuFileView[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restore(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/menu-files/${id}`, {
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
    return (
      <p className="card px-3 py-6 text-center text-sm text-ink-faint">
        削除されたメニューPDFはありません。
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-card border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {items.map((f) => (
          <li key={f.id} className="card flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-sm font-bold text-ink">{formatDateWithWeekday(f.date)}</div>
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-xs text-aqua-600 underline underline-offset-2"
              >
                {f.file_name}
              </a>
            </div>
            <button
              type="button"
              className="btn shrink-0 text-xs"
              disabled={busyId === f.id}
              onClick={() => restore(f.id)}
            >
              {busyId === f.id ? '復元中…' : '復元'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

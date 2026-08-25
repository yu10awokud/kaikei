'use client';

import { useState } from 'react';
import type { Member, Place } from '@/lib/types';

type MasterItem = Member | Place;

// ============================================================
// 管理画面：部員 / 練習場所 の共通エディタ
//   追加・名前と色の編集・並び替え・在籍(有効)フラグの切り替え
//   ※ 削除はしない（過去の履歴と集計を壊さないため）
// ============================================================

export default function MasterAdmin({
  endpoint,
  label,
  activeLabel,
  initialItems,
}: {
  endpoint: 'members' | 'places';
  label: string;
  activeLabel: string;
  initialItems: MasterItem[];
}) {
  const [items, setItems] = useState<MasterItem[]>(initialItems);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#4A90D9');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '処理に失敗しました。');
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : '処理に失敗しました。');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    const json = await call(`/api/${endpoint}`, 'POST', { name, color: newColor });
    if (json?.item) {
      setItems((prev) => [...prev, json.item]);
      setNewName('');
    }
  }

  async function handlePatch(id: string, patch: Record<string, unknown>) {
    const json = await call(`/api/${endpoint}/${id}`, 'PATCH', patch);
    if (json?.item) setItems((prev) => prev.map((i) => (i.id === id ? json.item : i)));
  }

  async function handleMove(index: number, diff: number) {
    const next = [...items];
    const target = index + diff;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next); // 先に画面を動かして、あとからサーバーに反映
    await call(`/api/${endpoint}`, 'PUT', { ids: next.map((i) => i.id) });
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-card border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={item.id} className="card p-3">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={item.color}
                onChange={(e) => handlePatch(item.id, { color: e.target.value })}
                className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-line bg-white"
                aria-label={`${item.name} の色`}
              />
              <input
                type="text"
                defaultValue={item.name}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value && value !== item.name) handlePatch(item.id, { name: value });
                }}
                className="field min-w-0 flex-1"
                aria-label={`${label}の名前`}
              />
              <div className="flex shrink-0 flex-col gap-1">
                <button type="button" className="btn px-2 py-0.5 text-xs" disabled={busy || index === 0}
                  onClick={() => handleMove(index, -1)} aria-label="上へ">▲</button>
                <button type="button" className="btn px-2 py-0.5 text-xs" disabled={busy || index === items.length - 1}
                  onClick={() => handleMove(index, 1)} aria-label="下へ">▼</button>
              </div>
            </div>

            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.is_active}
                onChange={(e) => handlePatch(item.id, { is_active: e.target.checked })}
                className="h-4 w-4 accent-aqua-600"
              />
              <span className={item.is_active ? '' : 'text-ink-faint'}>{activeLabel}</span>
            </label>

            {/* 練習場所だけ：オフ（練習なし）として扱うかどうか */}
            {endpoint === 'places' && (
              <label className="mt-1.5 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean((item as Place).is_off)}
                  onChange={(e) => handlePatch(item.id, { is_off: e.target.checked })}
                  className="h-4 w-4 accent-aqua-600"
                />
                <span className="text-ink-soft">
                  オフ（練習なし）として扱う
                  <span className="block text-xs text-ink-faint">
                    担当者欄を出さずに、カレンダーに灰色で表示します
                  </span>
                </span>
              </label>
            )}
          </li>
        ))}
      </ul>

      <div className="card p-3">
        <div className="mb-2 text-sm font-bold">{label}を追加</div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-line bg-white"
            aria-label="色"
          />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`${label}の名前`}
            className="field min-w-0 flex-1"
          />
          <button type="button" className="btn-primary shrink-0" disabled={busy || !newName.trim()} onClick={handleAdd}>
            追加
          </button>
        </div>
      </div>
    </div>
  );
}

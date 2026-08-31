'use client';

import { useState } from 'react';
import type { Notice } from '@/lib/types';

// ============================================================
// 管理画面：お知らせの追加・編集・表示切替・削除
// ============================================================
export default function NoticesAdmin({ initialNotices }: { initialNotices: Notice[] }) {
  const [notices, setNotices] = useState(initialNotices);
  const [newBody, setNewBody] = useState('');
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
    const text = newBody.trim();
    if (!text) return;
    const json = await call('/api/notices', 'POST', { body: text });
    if (json?.notice) {
      setNotices((prev) => [...prev, json.notice]);
      setNewBody('');
    }
  }

  async function handlePatch(id: string, patch: Record<string, unknown>) {
    const json = await call(`/api/notices/${id}`, 'PATCH', patch);
    if (json?.notice) {
      setNotices((prev) => prev.map((n) => (n.id === id ? json.notice : n)));
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('このお知らせを削除します。\n（元に戻せません）\nよろしいですか？')) return;
    const json = await call(`/api/notices/${id}`, 'DELETE');
    if (json) setNotices((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-card border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {notices.length > 0 && (
        <ul className="space-y-2">
          {notices.map((n) => (
            <li key={n.id} className="card p-3">
              <textarea
                className="field min-h-[72px] text-sm"
                defaultValue={n.body}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value && value !== n.body) handlePatch(n.id, { body: value });
                }}
              />

              <div className="mt-2 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={n.is_visible}
                    onChange={(e) => handlePatch(n.id, { is_visible: e.target.checked })}
                    className="h-4 w-4 accent-aqua-600"
                  />
                  <span className={n.is_visible ? 'text-ink-soft' : 'text-ink-faint'}>
                    トップページに表示する
                  </span>
                </label>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDelete(n.id)}
                  className="shrink-0 text-[13px] font-medium text-rose-600"
                >
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="card p-3">
        <div className="mb-2 text-sm font-bold text-ink">お知らせを追加</div>
        <textarea
          className="field min-h-[72px] text-sm"
          value={newBody}
          placeholder={'例：9/15の練習は場所が変更になりました\n（改行して複数行も書けます）'}
          onChange={(e) => setNewBody(e.target.value)}
        />
        <button
          type="button"
          className="btn-primary mt-2 w-full"
          disabled={busy || !newBody.trim()}
          onClick={handleAdd}
        >
          {busy ? '保存中…' : '追加する'}
        </button>
      </div>

      <p className="px-1 text-xs text-ink-faint">
        文章を書き換えたあと、入力欄の外をタップすると保存されます。
        表示のチェックを外すと、消さずにトップページから隠せます。
      </p>
    </div>
  );
}

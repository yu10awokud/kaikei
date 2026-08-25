'use client';

import { useMemo, useState } from 'react';
import { todayKey } from '@/lib/date';
import { RELEASE_CATEGORY_LABEL, type Release, type ReleaseCategory } from '@/lib/types';

// ============================================================
// バージョン管理
//   更新履歴の閲覧・検索・絞り込みと、追加／編集／削除
// ============================================================

type Draft = {
  version: string;
  released_on: string;
  category: ReleaseCategory;
  notes: string;
  author: string;
};

const emptyDraft = (): Draft => ({
  version: '',
  released_on: todayKey(),
  category: 'major',
  notes: '',
  author: '',
});

const toDraft = (r: Release): Draft => ({
  version: r.version,
  released_on: r.released_on,
  category: r.category,
  notes: r.notes,
  author: r.author,
});

/** '2026-09-20' → '2026.09.20' */
function formatDate(key: string): string {
  return key.replaceAll('-', '.');
}

export default function ReleaseList({ initialReleases }: { initialReleases: Release[] }) {
  const [releases, setReleases] = useState(initialReleases);
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<'all' | ReleaseCategory>('all');

  // 編集中の行 id（'new' は新規追加）
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const word = keyword.trim().toLowerCase();
    return releases.filter((r) => {
      if (filter !== 'all' && r.category !== filter) return false;
      if (!word) return true;
      return (
        r.version.toLowerCase().includes(word) ||
        r.notes.toLowerCase().includes(word) ||
        r.author.toLowerCase().includes(word)
      );
    });
  }, [releases, keyword, filter]);

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

  async function handleSave() {
    if (editingId === 'new') {
      const json = await call('/api/releases', 'POST', draft);
      if (json?.release) {
        setReleases((prev) => sortReleases([json.release, ...prev]));
        setEditingId(null);
      }
      return;
    }
    if (!editingId) return;
    const json = await call(`/api/releases/${editingId}`, 'PATCH', draft);
    if (json?.release) {
      setReleases((prev) => sortReleases(prev.map((r) => (r.id === editingId ? json.release : r))));
      setEditingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('この履歴を削除します。よろしいですか？')) return;
    const json = await call(`/api/releases/${id}`, 'DELETE');
    if (json) {
      setReleases((prev) => prev.filter((r) => r.id !== id));
      setEditingId(null);
    }
  }

  return (
    <div>
      {/* 検索 */}
      <input
        type="search"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="バージョン名・内容・担当者で検索"
        className="w-full rounded-full border border-line bg-white px-4 py-2.5 text-sm text-ink
                   placeholder:text-ink-faint focus:border-aqua-400 focus:outline-none focus:ring-2 focus:ring-aqua-100"
      />

      {/* 絞り込み */}
      <div className="mt-3 flex flex-wrap gap-2">
        {([
          ['all', 'すべて'],
          ['major', '主要更新'],
          ['fix', '修正'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full border px-4 py-1.5 text-[13px] font-bold transition-colors ${
              filter === key
                ? 'border-aqua-700 bg-aqua-700 text-white'
                : 'border-line bg-white text-ink-soft active:bg-line-soft'
            }`}
          >
            {label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => {
            setDraft(emptyDraft());
            setEditingId('new');
            setError(null);
          }}
          className="ml-auto rounded-full border border-line bg-white px-4 py-1.5 text-[13px] font-bold text-ink-soft active:bg-line-soft"
        >
          ＋ 追加
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-card border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {/* 新規追加フォーム */}
      {editingId === 'new' && (
        <div className="mt-3">
          <ReleaseForm
            draft={draft}
            setDraft={setDraft}
            busy={busy}
            onSave={handleSave}
            onCancel={() => setEditingId(null)}
          />
        </div>
      )}

      {/* 一覧 */}
      <div className="mt-4 space-y-3">
        {shown.length === 0 ? (
          <p className="rounded-card border border-line bg-line-soft/50 px-4 py-8 text-center text-sm text-ink-faint">
            {releases.length === 0 ? '履歴がまだありません' : '条件に合う履歴がありません'}
          </p>
        ) : (
          shown.map((r) =>
            editingId === r.id ? (
              <ReleaseForm
                key={r.id}
                draft={draft}
                setDraft={setDraft}
                busy={busy}
                onSave={handleSave}
                onCancel={() => setEditingId(null)}
                onDelete={() => handleDelete(r.id)}
              />
            ) : (
              <article key={r.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-en rounded-full bg-aqua-700 px-3 py-1 text-[13px] font-semibold text-white">
                    {r.version}
                  </span>
                  <span className="font-en pt-1 text-[13px] font-medium text-ink-faint">
                    {formatDate(r.released_on)}
                  </span>
                </div>

                <div className="mt-3 flex gap-4">
                  <span className="w-20 shrink-0 pt-0.5 text-[13px] text-ink-faint">
                    {RELEASE_CATEGORY_LABEL[r.category]}
                  </span>
                  <ul className="min-w-0 flex-1 space-y-1">
                    {r.notes
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line, i) => (
                        <li key={i} className="flex gap-2 text-sm text-ink">
                          <span aria-hidden className="text-ink-faint">
                            ・
                          </span>
                          <span className="min-w-0">{line}</span>
                        </li>
                      ))}
                  </ul>
                </div>

                <div className="mt-3 flex items-center gap-4 border-t border-line pt-3">
                  <span className="w-20 shrink-0 text-[13px] text-ink-faint">担当者</span>
                  <span className="min-w-0 flex-1 truncate rounded-full bg-line-soft px-3 py-1 text-[13px] font-medium text-ink">
                    {r.author || '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(toDraft(r));
                      setEditingId(r.id);
                      setError(null);
                    }}
                    className="shrink-0 text-[13px] font-medium text-aqua-600 underline underline-offset-2"
                  >
                    編集
                  </button>
                </div>
              </article>
            )
          )
        )}
      </div>
    </div>
  );
}

/** 新しい順に並べ直す */
function sortReleases(list: Release[]): Release[] {
  return [...list].sort((a, b) =>
    a.released_on === b.released_on
      ? b.created_at.localeCompare(a.created_at)
      : b.released_on.localeCompare(a.released_on)
  );
}

// ------------------------------------------------------------
// 追加・編集フォーム
// ------------------------------------------------------------
function ReleaseForm({
  draft,
  setDraft,
  busy,
  onSave,
  onCancel,
  onDelete,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="card space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-faint">バージョン名</label>
          <input
            type="text"
            className="field"
            value={draft.version}
            placeholder="v1.0.3"
            onChange={(e) => setDraft({ ...draft, version: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-faint">日付</label>
          <input
            type="date"
            className="field"
            value={draft.released_on}
            onChange={(e) => setDraft({ ...draft, released_on: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-faint">区分</label>
        <select
          className="field"
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value as ReleaseCategory })}
        >
          <option value="major">主要更新</option>
          <option value="fix">修正</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-faint">
          アップデート内容（1行に1項目）
        </label>
        <textarea
          className="field min-h-[96px]"
          value={draft.notes}
          placeholder={'マネ欄に記号Ⓗを追加\n表示速度を改善'}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-faint">担当者</label>
        <input
          type="text"
          className="field"
          value={draft.author}
          placeholder="山田"
          onChange={(e) => setDraft({ ...draft, author: e.target.value })}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" className="btn-primary flex-1" disabled={busy} onClick={onSave}>
          {busy ? '保存中…' : '保存する'}
        </button>
        <button type="button" className="btn px-5" disabled={busy} onClick={onCancel}>
          やめる
        </button>
      </div>

      {onDelete && (
        <button
          type="button"
          className="w-full rounded-full border border-rose-200 px-4 py-2 text-[13px] font-medium text-rose-600 tap"
          disabled={busy}
          onClick={onDelete}
        >
          この履歴を削除
        </button>
      )}
    </div>
  );
}

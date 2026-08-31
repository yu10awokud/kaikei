'use client';

import { useEffect, useRef, useState } from 'react';
import type { MenuFileView } from '@/lib/types';

// ============================================================
// その日のメニューPDF
//   編集モーダルの中に置き、アップロードと削除ができるようにする。
//   削除は論理削除なので、管理画面からいつでも戻せる。
// ============================================================

/** 12345 → '12.1 KB' */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function MenuFiles({ dateKey }: { dateKey: string }) {
  const [files, setFiles] = useState<MenuFileView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // その日のぶんを読み込む
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/menu-files?date=${dateKey}`);
        const json = await res.json();
        if (!alive) return;
        if (res.ok) setFiles(json.files ?? []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [dateKey]);

  async function handleUpload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('date', dateKey);
      form.append('file', file);

      const res = await fetch('/api/menu-files', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'アップロードに失敗しました。');
      setFiles((prev) => [json.file, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'アップロードに失敗しました。');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`「${name}」を削除します。\n（管理画面から復元できます）\nよろしいですか？`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/menu-files/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '削除に失敗しました。');
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-card border border-line bg-line-soft/50 px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-ink">この日のメニュー（PDF）</span>
        <span className="font-en text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint">
          Menu PDF
        </span>
      </div>

      {loading ? (
        <p className="py-3 text-center text-xs text-ink-faint">読み込み中…</p>
      ) : (
        <>
          {files.length > 0 && (
            <ul className="mt-2.5 space-y-1.5">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2"
                >
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1"
                  >
                    <span className="block truncate text-[13px] font-medium text-aqua-600 underline underline-offset-2">
                      {f.file_name}
                    </span>
                    <span className="font-en block text-[11px] text-ink-faint">
                      {formatSize(f.size_bytes)}
                    </span>
                  </a>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(f.id, f.file_name)}
                    className="shrink-0 text-[12px] font-medium text-rose-600"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />

          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="mt-2.5 w-full rounded-full border border-line bg-white px-4 py-2 text-[13px] font-bold text-ink-soft tap disabled:opacity-50"
          >
            {busy ? '処理中…' : files.length > 0 ? 'PDFを追加' : 'PDFをアップロード'}
          </button>

          <p className="mt-1.5 text-center text-[11px] text-ink-faint">
            PDFのみ・10MBまで
          </p>
        </>
      )}

      {error && (
        <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

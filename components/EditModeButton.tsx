"use client";

import { useState } from "react";
import { useEditMode } from "./EditModeProvider";

/**
 * 画面右上の「編集モード」ボタン。
 *
 * 合言葉はこの入力欄からサーバーへ送るだけで、
 * このファイルのどこにも「正解の合言葉」は出てきません。
 * （正解を知っているのは /api/edit-mode だけ）
 */
export function EditModeButton() {
  const { enabled, ready, unlock, lock } = useEditMode();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await unlock(value);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setValue("");
    setOpen(false);
  }

  // sessionStorage を読む前は状態が確定しないので、枠だけ出しておく（レイアウトのガタつき防止）
  if (!ready) {
    return <div className="h-9 w-28 rounded-md bg-white/10" aria-hidden />;
  }

  if (enabled) {
    return (
      <button
        type="button"
        onClick={lock}
        className="no-print rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-600"
        title="クリックすると編集モードを終了します"
      >
        編集モード：ON
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="no-print rounded-md bg-white/15 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/25"
      >
        編集モード
      </button>

      {open && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          {/* 背景クリックで閉じるが、中身のクリックは伝播を止める */}
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
          >
            <h2 className="text-lg font-bold text-slate-800">編集モードの解除</h2>
            <p className="mt-1 text-sm text-slate-500">
              合言葉を入力すると、予定やタスクの追加・編集ができるようになります。
            </p>
            <input
              type="password"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="合言葉"
              className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {busy ? "確認中…" : "解除"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

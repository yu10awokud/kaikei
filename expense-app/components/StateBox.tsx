'use client';

// ============================================================
// 読み込み中・エラー・データなし の表示をまとめた部品
//   カレンダーの取得に失敗しても画面が真っ白にならないよう、
//   必ずメッセージと「再読み込み」ボタンを出す。
// ============================================================

export function Loading({ label = '読み込み中です…' }: { label?: string }) {
  return (
    <div className="card px-4 py-8 text-center text-sm text-sub">{label}</div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-danger/40 bg-red-50 px-4 py-4">
      <p className="text-sm font-bold text-danger">うまく読み込めませんでした</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{message}</p>
      {onRetry && (
        <button type="button" className="btn-ghost mt-3" onClick={onRetry}>
          再読み込みする
        </button>
      )}
    </div>
  );
}

export function EmptyBox({ children }: { children: React.ReactNode }) {
  return <div className="card px-4 py-8 text-center text-sm text-sub">{children}</div>;
}

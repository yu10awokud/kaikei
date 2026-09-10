'use client';

// ============================================================
// 読み込み中・エラー・データなし の表示をまとめた部品
//   取得に失敗しても画面が真っ白にならないよう、
//   必ずメッセージと「再読み込み」ボタンを出す。
// ============================================================

export function Loading({ label = '読み込み中です…' }: { label?: string }) {
  return (
    <div className="rounded-card border border-line bg-line-soft/40 px-4 py-10 text-center text-sm text-ink-faint">
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-card border border-alert/30 bg-alert-soft px-4 py-4">
      <p className="text-[13px] font-bold text-alert">うまく読み込めませんでした</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-[13px] text-ink-soft">{message}</p>
      {onRetry && (
        <button type="button" className="btn mt-3" onClick={onRetry}>
          再読み込みする
        </button>
      )}
    </div>
  );
}

export function EmptyBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-line-soft/40 px-4 py-10 text-center text-sm text-ink-faint">
      {children}
    </div>
  );
}

'use client';

import { useEffect } from 'react';

// ============================================================
// 領収書のサムネイルと、タップしたときの拡大表示
//   バケットは非公開なので、URL はサーバーが発行した
//   有効期限つきの一時URL（30分）を使う。
// ============================================================

export function ReceiptThumb({ url, onOpen }: { url: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="shrink-0 overflow-hidden rounded-xl border border-line"
      aria-label="領収書を拡大表示する"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="領収書" className="h-16 w-16 object-cover" loading="lazy" />
    </button>
  );
}

export function ReceiptViewer({ url, onClose }: { url: string; onClose: () => void }) {
  // Esc キーでも閉じられるようにする
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="領収書（拡大）"
        className="max-h-[80vh] max-w-full rounded-card object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button type="button" className="btn mt-4" onClick={onClose}>
        閉じる
      </button>
    </div>
  );
}

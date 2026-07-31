"use client";

import { useEffect } from "react";

/**
 * 使い回すモーダル（ポップアップ）。
 * Esc キーで閉じる、背景クリックで閉じる、といった共通の振る舞いをここに集約します。
 */
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  // Esc キーで閉じる。イベント登録は必ず後片付け（return の関数）まで書くこと。
  // 書かないとモーダルを開くたびにリスナーが増えていきます。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={[
          "w-full rounded-lg bg-white shadow-xl",
          wide ? "max-w-2xl" : "max-w-md",
        ].join(" ")}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-bold text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/** フォームの1行（ラベル + 入力欄） */
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

/** 入力欄の共通クラス（Tailwind のクラスを毎回書かなくて済むように定数化） */
export const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

export const btnPrimary =
  "rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:opacity-50";

export const btnGhost =
  "rounded-md px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100";

export const btnDanger =
  "rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50";

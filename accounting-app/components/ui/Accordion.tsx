'use client';

import { useId, useState } from 'react';

// ============================================================
// アコーディオン（見出しを押すと中身が開閉する）
// ============================================================
export default function Accordion({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: React.ReactNode;
  /** 見出しの右側に出す補足（件数など） */
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left tap"
      >
        <span className="text-[14px] font-bold text-ink">{title}</span>
        <span className="flex items-center gap-2 text-[12px] text-ink-faint">
          {summary}
          <span
            aria-hidden="true"
            className={`inline-block transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          >
            ▾
          </span>
        </span>
      </button>
      <div id={panelId} hidden={!open} className="border-t border-line px-4 py-3">
        {children}
      </div>
    </div>
  );
}

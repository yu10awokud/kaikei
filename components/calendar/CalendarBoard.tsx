"use client";

import { useState } from "react";
import Link from "next/link";
import { useEditMode } from "@/components/EditModeProvider";
import { EventDialog } from "./EventDialog";
import { BulkDialog } from "./BulkDialog";
import { EVENT_TYPE_LABEL, WEEKDAY_LABEL, type EventRow, type EventType } from "@/lib/types";
import { addMonths, buildCalendarGrid, today, toDateString, trimSeconds } from "@/lib/date-utils";

/**
 * カレンダー本体（Client Component）
 *
 * 予定データはサーバー（app/calendar/page.tsx）から props で受け取ります。
 * このコンポーネントがやるのは「表示」と「クリックへの反応」だけです。
 *
 * 印刷について:
 *   この同じ HTML が印刷にも使われます。画面用の Tailwind クラスに加えて
 *   print-calendar / cal-cell / cal-event といったクラスを付けておき、
 *   app/globals.css の @media print でそれらを上書きしています。
 *   「印刷用に別の画面を作る」より保守が楽です。
 */
export function CalendarBoard({
  year,
  month,
  events,
}: {
  year: number;
  month: number;
  events: EventRow[];
}) {
  const { enabled } = useEditMode();
  const [dialog, setDialog] = useState<{ date: string; event: EventRow | null } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const grid = buildCalendarGrid(year, month);
  const current = new Date(year, month - 1, 1);
  const prev = addMonths(current, -1);
  const next = addMonths(current, 1);
  const ymParam = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  // 日付ごとに予定をまとめておく（マスを描くたびに全件走査しないで済むように）
  const byDate = new Map<string, EventRow[]>();
  for (const ev of events) {
    const list = byDate.get(ev.date) ?? [];
    list.push(ev);
    byDate.set(ev.date, list);
  }

  const todayStr = toDateString(today());

  return (
    <div className="print-area">
      {/* ---------- 印刷したときだけ出るタイトル ---------- */}
      <div className="print-only print-title">
        <span className="print-year">{year}年</span>
        <span className="print-month">{month}月</span>
        <span className="print-year"> 予定表</span>
        <div className="print-sub">水泳部</div>
      </div>

      {/* ---------- 画面用の操作エリア（印刷では消える） ---------- */}
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?ym=${ymParam(prev)}`}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          >
            ← 前月
          </Link>
          <span className="min-w-32 text-center text-lg font-bold">
            {year}年{month}月
          </span>
          <Link
            href={`/calendar?ym=${ymParam(next)}`}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          >
            翌月 →
          </Link>
          <Link href="/calendar" className="ml-1 text-sm text-sky-700 hover:underline">
            今月
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {enabled && (
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              曜日まとめ登録
            </button>
          )}
          {/* window.print() を呼ぶだけで、ブラウザの印刷ダイアログが開きます。
              PDF にしたい場合は「送信先」で「PDFに保存」を選べばOK。ライブラリ不要です。 */}
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            🖨 印刷 / PDF
          </button>
        </div>
      </div>

      {!enabled && (
        <p className="no-print mb-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
          閲覧モードです。予定を追加・編集するには右上の「編集モード」から合言葉を入力してください。
        </p>
      )}

      {/* ---------- カレンダー ---------- */}
      <div className="print-calendar grid grid-cols-7 overflow-hidden rounded-lg border-t border-l border-slate-300 bg-white">
        {WEEKDAY_LABEL.map((label, i) => (
          <div
            key={label}
            className={[
              "cal-head cal-head-row border-r border-b border-slate-300 py-1.5 text-center text-sm font-bold",
              i === 0 ? "text-red-600" : i === 6 ? "text-sky-700" : "text-slate-600",
            ].join(" ")}
          >
            {label}
          </div>
        ))}

        {grid.map((d) => {
          const key = toDateString(d);
          const isCurrentMonth = d.getMonth() + 1 === month;
          const dayEvents = byDate.get(key) ?? [];

          return (
            <div
              key={key}
              onClick={() => enabled && setDialog({ date: key, event: null })}
              className={[
                "cal-cell min-h-24 border-r border-b border-slate-300 p-1 align-top",
                isCurrentMonth ? "bg-white" : "is-other bg-slate-50 text-slate-400",
                key === todayStr ? "ring-2 ring-inset ring-amber-400" : "",
                enabled ? "cursor-pointer hover:bg-sky-50" : "",
              ].join(" ")}
            >
              <div
                className={[
                  "cal-date text-xs font-bold",
                  d.getDay() === 0 ? "text-red-600" : d.getDay() === 6 ? "text-sky-700" : "",
                ].join(" ")}
              >
                {d.getDate()}
              </div>

              {dayEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={(e) => {
                    // 親（マス）の onClick が発火して「新規追加」になってしまわないよう止める
                    e.stopPropagation();
                    if (enabled) setDialog({ date: key, event: ev });
                  }}
                  className={[
                    "cal-event mt-0.5 truncate rounded px-1 py-0.5 text-[11px] leading-tight",
                    `t-${ev.type}`,
                    SCREEN_TYPE_CLASS[ev.type],
                    enabled ? "cursor-pointer hover:brightness-95" : "",
                  ].join(" ")}
                  title={[ev.title, ev.place, ev.memo].filter(Boolean).join(" / ")}
                >
                  {/* 記号は印刷時に色が読めない場合の保険。画面でも視認性が上がります */}
                  <span className="cal-mark">{TYPE_MARK[ev.type]}</span>
                  {ev.start_time && <span className="mr-1">{trimSeconds(ev.start_time)}</span>}
                  {ev.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* ---------- 凡例（画面でも印刷でも出す） ---------- */}
      <div className="print-legend mt-3 flex flex-wrap gap-4 text-sm">
        {(Object.keys(EVENT_TYPE_LABEL) as EventType[]).map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span
              className={["inline-block h-4 w-6 rounded-sm border", LEGEND_CLASS[t]].join(" ")}
            />
            {TYPE_MARK[t]} {EVENT_TYPE_LABEL[t]}
          </span>
        ))}
      </div>

      {dialog && (
        <EventDialog
          date={dialog.date}
          event={dialog.event}
          onClose={() => setDialog(null)}
        />
      )}
      {bulkOpen && (
        <BulkDialog year={year} month={month} onClose={() => setBulkOpen(false)} />
      )}
    </div>
  );
}

/** 種別ごとの記号。色が使えない場面（白黒印刷）でも区別できるようにする */
export const TYPE_MARK: Record<EventType, string> = {
  practice: "●",
  event: "▲",
  off: "−",
};

const SCREEN_TYPE_CLASS: Record<EventType, string> = {
  practice: "bg-sky-100 text-sky-900 border border-sky-400",
  event: "bg-orange-100 text-orange-900 border-2 border-orange-500 font-bold",
  off: "bg-slate-200 text-slate-700 border border-dashed border-slate-500",
};

const LEGEND_CLASS: Record<EventType, string> = {
  practice: "bg-sky-100 border-sky-500",
  event: "bg-orange-100 border-orange-600 border-2",
  off: "bg-slate-200 border-slate-500 border-dashed",
};

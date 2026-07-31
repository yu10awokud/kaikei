"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEditMode } from "@/components/EditModeProvider";
import { DueBadge, PriorityBadge } from "@/components/tasks/TaskManager";
import { TYPE_MARK } from "@/components/calendar/CalendarBoard";
import { buildAutoTaskGroups, rankLabel, type AutoTaskGroup, type AutoTaskItem } from "@/lib/auto-tasks";
import { compareTasks } from "@/lib/task-sort";
import {
  buildCalendarGrid,
  daysFromToday,
  formatShortJa,
  parseDateString,
  toDateString,
  today,
  trimSeconds,
} from "@/lib/date-utils";
import {
  EVENT_TYPE_LABEL,
  METHOD_LABEL,
  WEEKDAY_LABEL,
  type EventRow,
  type EventType,
  type PoolPriorityRow,
  type PoolRow,
  type RoutineLogRow,
  type RoutineResult,
  type TaskRow,
} from "@/lib/types";

/**
 * TOP画面。
 *   1. 今月のカレンダー概観
 *   2. 次のイベントまであと〇日
 *   3. 要対応リスト（手動タスク + 自動算出タスクを統合し、期日が近い順）
 */
export function TopDashboard({
  year,
  month,
  events,
  nextEvent,
  tasks,
  pools,
  priorities,
  logs,
}: {
  year: number;
  month: number;
  events: EventRow[];
  nextEvent: EventRow | null;
  tasks: TaskRow[];
  pools: PoolRow[];
  priorities: PoolPriorityRow[];
  logs: RoutineLogRow[];
}) {
  // ページを開いた時点で、その場で自動タスクを算出します（cron は使いません）
  const autoGroups = useMemo(
    () => buildAutoTaskGroups({ pools, priorities, logs }),
    [pools, priorities, logs],
  );

  /**
   * 手動タスクと自動タスクを1本のリストに統合し、期日が近い順に並べます。
   * 「日付が決まっていないもの」は最後に回します。
   */
  const merged = useMemo(() => {
    type Entry =
      | { kind: "task"; sort: string | null; task: TaskRow }
      | { kind: "auto"; sort: string | null; group: AutoTaskGroup };

    const entries: Entry[] = [
      ...tasks.map((t) => ({ kind: "task" as const, sort: t.due_date, task: t })),
      ...autoGroups.map((g) => ({
        kind: "auto" as const,
        sort: g.sortDate ? toDateString(g.sortDate) : null,
        group: g,
      })),
    ];

    return entries.sort((a, b) => {
      if (a.sort && b.sort) {
        if (a.sort !== b.sort) return a.sort < b.sort ? -1 : 1;
      } else if (a.sort) {
        return -1;
      } else if (b.sort) {
        return 1;
      }
      // 同じ日付なら、手動タスク同士は優先度順、それ以外は自動を先に出す
      if (a.kind === "task" && b.kind === "task") return compareTasks(a.task, b.task);
      return a.kind === "auto" ? -1 : 1;
    });
  }, [tasks, autoGroups]);

  return (
    <div className="space-y-6">
      <MonthOverview year={year} month={month} events={events} />
      <NextEventCard event={nextEvent} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">要対応リスト</h2>
          <span className="text-sm text-slate-500">
            手動タスク {tasks.length} 件 / 自動算出 {autoGroups.length} 枠
          </span>
        </div>

        {merged.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-500">
            今すぐ対応が必要なものはありません。
          </p>
        ) : (
          <ul className="space-y-3">
            {merged.map((entry) =>
              entry.kind === "task" ? (
                <ManualTaskCard key={`t-${entry.task.id}`} task={entry.task} />
              ) : (
                <AutoGroupCard key={`a-${entry.group.key}`} group={entry.group} />
              ),
            )}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ============================================================
   1. 今月のカレンダー概観
   ============================================================ */
function MonthOverview({
  year,
  month,
  events,
}: {
  year: number;
  month: number;
  events: EventRow[];
}) {
  const grid = buildCalendarGrid(year, month);
  const todayStr = toDateString(today());

  const byDate = new Map<string, EventRow[]>();
  for (const ev of events) {
    const list = byDate.get(ev.date) ?? [];
    list.push(ev);
    byDate.set(ev.date, list);
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xl font-bold">
          {year}年{month}月の予定
        </h2>
        <Link href="/calendar" className="text-sm text-sky-700 hover:underline">
          カレンダーを開く →
        </Link>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-lg border-t border-l border-slate-300 bg-white">
        {WEEKDAY_LABEL.map((label, i) => (
          <div
            key={label}
            className={[
              "border-r border-b border-slate-300 py-1 text-center text-xs font-bold",
              i === 0 ? "text-red-600" : i === 6 ? "text-sky-700" : "text-slate-500",
            ].join(" ")}
          >
            {label}
          </div>
        ))}
        {grid.map((d) => {
          const key = toDateString(d);
          const isCurrent = d.getMonth() + 1 === month;
          const dayEvents = byDate.get(key) ?? [];
          return (
            <div
              key={key}
              className={[
                "min-h-16 border-r border-b border-slate-300 p-1",
                isCurrent ? "bg-white" : "bg-slate-50 text-slate-400",
                key === todayStr ? "ring-2 ring-inset ring-amber-400" : "",
              ].join(" ")}
            >
              <div className="text-[11px] font-bold">{d.getDate()}</div>
              {dayEvents.map((ev) => (
                <div
                  key={ev.id}
                  className={[
                    "mt-0.5 truncate rounded px-1 text-[10px] leading-tight",
                    OVERVIEW_CLASS[ev.type],
                  ].join(" ")}
                  title={ev.title}
                >
                  {ev.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-4 text-xs text-slate-600">
        {(Object.keys(EVENT_TYPE_LABEL) as EventType[]).map((t) => (
          <span key={t} className="flex items-center gap-1">
            <span className={`inline-block h-3 w-4 rounded-sm ${OVERVIEW_CLASS[t]}`} />
            {TYPE_MARK[t]} {EVENT_TYPE_LABEL[t]}
          </span>
        ))}
      </div>
    </section>
  );
}

const OVERVIEW_CLASS: Record<EventType, string> = {
  practice: "bg-sky-200 text-sky-900",
  event: "bg-orange-300 text-orange-900 font-bold",
  off: "bg-slate-300 text-slate-700",
};

/* ============================================================
   2. 次のイベントまであと〇日
   ============================================================ */
function NextEventCard({ event }: { event: EventRow | null }) {
  if (!event) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 text-slate-500">
        予定されているイベントはありません。
      </section>
    );
  }

  const days = daysFromToday(parseDateString(event.date));

  return (
    <section className="rounded-lg border-2 border-orange-400 bg-orange-50 p-4">
      <p className="text-sm font-bold text-orange-800">次のイベント</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
        <span className="text-2xl font-bold text-orange-900">
          {days === 0 ? "今日！" : `あと ${days} 日`}
        </span>
        <span className="text-lg font-medium">{event.title}</span>
        <span className="text-slate-600">
          {formatShortJa(parseDateString(event.date))}
          {event.start_time && ` ${trimSeconds(event.start_time)}`}
          {event.place && ` / ${event.place}`}
        </span>
      </p>
    </section>
  );
}

/* ============================================================
   3-a. 手動タスクのカード
   ============================================================ */
function ManualTaskCard({ task }: { task: TaskRow }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {/* 自動算出タスクと見分けが付くよう、手動には「手動」バッジを付ける */}
        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-bold text-slate-600">
          手動
        </span>
        <PriorityBadge priority={task.priority} />
        <span className="font-medium">{task.title}</span>
        {task.due_date && <DueBadge days={daysFromToday(parseDateString(task.due_date))} />}
      </div>
      {task.memo && (
        <p className="preserve-newlines mt-1 text-sm text-slate-600">{task.memo}</p>
      )}
      <Link href="/tasks" className="mt-1 inline-block text-xs text-sky-700 hover:underline">
        タスク管理で編集 →
      </Link>
    </li>
  );
}

/* ============================================================
   3-b. 自動算出タスク（曜日 × 利用月 のグループ）
   ============================================================ */
function AutoGroupCard({ group }: { group: AutoTaskGroup }) {
  const { enabled } = useEditMode();

  /**
   * 「取れなかった」を押した直後に、次の候補を強調するための状態。
   * 記録するとその候補はリストから消えるので、残っている先頭＝次の候補になります。
   */
  const [highlightNext, setHighlightNext] = useState(false);

  return (
    <li className="rounded-lg border-l-4 border-l-sky-600 border-y border-r border-slate-200 bg-sky-50/40 p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {/* 自動算出であることが一目で分かるバッジ */}
        <span className="rounded bg-sky-600 px-1.5 py-0.5 text-xs font-bold text-white">
          自動
        </span>
        <span className="font-bold text-slate-800">{group.heading}</span>
        {group.sortDate && (
          <span className="text-sm text-slate-500">
            受付開始 {formatShortJa(group.sortDate)}
          </span>
        )}
      </div>

      <ol className="mt-2 space-y-2">
        {group.items.map((item, index) => (
          <AutoTaskRow
            key={item.key}
            item={item}
            editable={enabled}
            emphasize={highlightNext && index === 0}
            onFailed={() => setHighlightNext(true)}
          />
        ))}
      </ol>
    </li>
  );
}

function AutoTaskRow({
  item,
  editable,
  emphasize,
  onFailed,
}: {
  item: AutoTaskItem;
  editable: boolean;
  emphasize: boolean;
  onFailed: () => void;
}) {
  const router = useRouter();
  const { editFetch } = useEditMode();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  async function record(result: RoutineResult) {
    setBusy(true);
    setError(null);
    const res = await editFetch("/api/routine-logs", {
      method: "POST",
      body: JSON.stringify({
        pool_id: item.poolId,
        target_month: item.targetMonth,
        weekday: item.weekday,
        result,
      }),
    });
    setBusy(false);

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "記録に失敗しました");
      return;
    }

    // 「取れなかった」ときは、次の候補を強調表示するようグループに伝える
    if (result === "failed") onFailed();

    // サーバーからデータを取り直す → 記録済みの項目はリストから消える
    router.refresh();
  }

  return (
    <li
      className={[
        "rounded-md border bg-white p-2.5",
        emphasize
          ? "border-amber-500 ring-2 ring-amber-300"
          : item.unlikely
            ? "border-slate-200 opacity-80"
            : "border-slate-200",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={[
            "rounded px-1.5 py-0.5 text-xs font-bold",
            item.rank === 0
              ? "bg-amber-100 text-amber-800"
              : item.rank === 1
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-100 text-slate-600",
          ].join(" ")}
        >
          {rankLabel(item)}
        </span>
        {emphasize && (
          <span className="rounded bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-white">
            ← 次はここ
          </span>
        )}
        <span className="font-medium">{item.label}</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
          {METHOD_LABEL[item.method]}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-slate-600">
        {item.openDate && (
          <span>
            受付開始 {formatShortJa(item.openDate)}
            {item.daysUntilOpen != null &&
              (item.daysUntilOpen > 0
                ? `（あと${item.daysUntilOpen}日）`
                : item.daysUntilOpen === 0
                  ? "（今日！）"
                  : `（${-item.daysUntilOpen}日経過）`)}
          </span>
        )}
        {item.ruleUnknown && (
          <span className="text-amber-700">受付開始日が未設定です</span>
        )}
        {item.contact && <span>連絡先: {item.contact}</span>}
        {item.staffName && <span>担当: {item.staffName}</span>}
        {item.note && <span className="text-slate-500">{item.note}</span>}
      </div>

      {item.manual && (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="text-xs text-sky-700 hover:underline"
          >
            {showManual ? "手順を隠す" : "手順メモを見る"}
          </button>
          {showManual && (
            <p className="preserve-newlines mt-1 rounded bg-amber-50 p-2 text-sm">
              {item.manual}
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {editable ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => record("booked")}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            予約できた
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => record("failed")}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            取れなかった
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => record("skipped")}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            見送り
          </button>
          <Link
            href="/pools"
            className="rounded-md px-2 py-1.5 text-sm text-sky-700 hover:underline"
          >
            プール情報を編集
          </Link>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          結果を記録するには編集モードを解除してください。
        </p>
      )}
    </li>
  );
}

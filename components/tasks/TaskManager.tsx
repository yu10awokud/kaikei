"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEditMode } from "@/components/EditModeProvider";
import { Field, Modal, btnDanger, btnGhost, btnPrimary, inputClass } from "@/components/ui/Modal";
import { PRIORITY_LABEL, type Priority, type TaskRow } from "@/lib/types";
import { compareTasks } from "@/lib/task-sort";
import { daysFromToday, parseDateString } from "@/lib/date-utils";

/**
 * タスク一覧 + 追加/編集/削除/完了チェック。
 */
export function TaskManager({ tasks }: { tasks: TaskRow[] }) {
  const { enabled } = useEditMode();
  const router = useRouter();
  const { editFetch } = useEditMode();

  const [dialog, setDialog] = useState<{ task: TaskRow | null } | null>(null);
  const [showDone, setShowDone] = useState(false);

  // 未完了 / 完了に分けて、それぞれ並べ替える
  const open = tasks.filter((t) => !t.done).sort(compareTasks);
  const done = tasks
    .filter((t) => t.done)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  async function toggleDone(task: TaskRow) {
    // done だけを送る → サーバー側で「チェックの切り替えだけ」と判定されます
    const res = await editFetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ done: !task.done }),
    });
    if (!res.ok) {
      alert("更新に失敗しました。編集モードが解除されているか確認してください。");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">タスク</h2>
        {enabled && (
          <button
            type="button"
            onClick={() => setDialog({ task: null })}
            className={btnPrimary}
          >
            ＋ タスクを追加
          </button>
        )}
      </div>

      {!enabled && (
        <p className="mb-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
          閲覧モードです。追加・編集するには右上の「編集モード」から合言葉を入力してください。
        </p>
      )}

      {/* ---------- 未完了 ---------- */}
      {open.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-500">
          未完了のタスクはありません。
        </p>
      ) : (
        <ul className="space-y-2">
          {open.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              editable={enabled}
              onToggle={() => toggleDone(task)}
              onEdit={() => setDialog({ task })}
            />
          ))}
        </ul>
      )}

      {/* ---------- 完了済み（折りたたみ） ---------- */}
      {done.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="flex w-full items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
          >
            <span>{showDone ? "▼" : "▶"}</span>
            完了済み（{done.length}件）
          </button>
          {showDone && (
            <ul className="mt-2 space-y-2">
              {done.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  editable={enabled}
                  onToggle={() => toggleDone(task)}
                  onEdit={() => setDialog({ task })}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {dialog && (
        <TaskDialog task={dialog.task} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

/** 一覧の1行 */
function TaskItem({
  task,
  editable,
  onToggle,
  onEdit,
}: {
  task: TaskRow;
  editable: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const due = task.due_date ? daysFromToday(parseDateString(task.due_date)) : null;

  return (
    <li
      className={[
        "flex items-start gap-3 rounded-lg border bg-white p-3 shadow-sm",
        task.done ? "border-slate-200 opacity-60" : "border-slate-200",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={task.done}
        disabled={!editable}
        onChange={onToggle}
        className="mt-1 h-5 w-5 shrink-0 accent-emerald-600 disabled:opacity-40"
        title={editable ? "完了/未完了を切り替え" : "編集モードで操作できます"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={task.priority} />
          <span className={["font-medium", task.done ? "line-through" : ""].join(" ")}>
            {task.title}
          </span>
        </div>
        {task.due_date && (
          <p className="mt-1 text-sm">
            <span className="text-slate-500">期日 {task.due_date}</span>{" "}
            {!task.done && <DueBadge days={due!} />}
          </p>
        )}
        {task.memo && (
          <p className="preserve-newlines mt-1 text-sm text-slate-600">{task.memo}</p>
        )}
      </div>
      {editable && (
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 rounded px-2 py-1 text-sm text-sky-700 hover:bg-sky-50"
        >
          編集
        </button>
      )}
    </li>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const cls: Record<Priority, string> = {
    high: "bg-red-100 text-red-700 ring-red-300",
    mid: "bg-amber-100 text-amber-800 ring-amber-300",
    low: "bg-slate-100 text-slate-600 ring-slate-300",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-bold ring-1 ${cls[priority]}`}>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

/** 期日までの残り日数バッジ。過ぎていたら赤くする */
export function DueBadge({ days }: { days: number }) {
  if (days < 0) {
    return (
      <span className="rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">
        {-days}日超過
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="rounded bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">
        今日
      </span>
    );
  }
  if (days <= 3) {
    return (
      <span className="rounded bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-white">
        あと{days}日
      </span>
    );
  }
  return <span className="text-xs text-slate-500">あと{days}日</span>;
}

/** 追加・編集フォーム */
function TaskDialog({ task, onClose }: { task: TaskRow | null; onClose: () => void }) {
  const router = useRouter();
  const { editFetch } = useEditMode();

  const [form, setForm] = useState({
    title: task?.title ?? "",
    priority: (task?.priority ?? "mid") as Priority,
    due_date: task?.due_date ?? "",
    memo: task?.memo ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await editFetch(task ? `/api/tasks/${task.id}` : "/api/tasks", {
      method: task ? "PATCH" : "POST",
      body: JSON.stringify(form),
    });
    setBusy(false);

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "保存に失敗しました");
      return;
    }
    router.refresh();
    onClose();
  }

  async function remove() {
    if (!task) return;
    if (!confirm(`「${task.title}」を削除します。よろしいですか？`)) return;
    setBusy(true);
    const res = await editFetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("削除に失敗しました");
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal title={task ? "タスクの編集" : "タスクの追加"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="タイトル">
          <input
            type="text"
            required
            autoFocus
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="例）9月分の会計報告をまとめる"
            className={inputClass}
          />
        </Field>

        <Field label="優先度">
          <div className="flex gap-2">
            {(["high", "mid", "low"] as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setForm({ ...form, priority: p })}
                className={[
                  "flex-1 rounded-md border px-3 py-2 text-sm font-medium",
                  form.priority === p
                    ? "border-sky-600 bg-sky-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
                ].join(" ")}
              >
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="期日" hint="空欄でも構いません">
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="メモ">
          <textarea
            rows={3}
            value={form.memo}
            onChange={(e) => setForm({ ...form, memo: e.target.value })}
            className={inputClass}
          />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          <div>
            {task && (
              <button type="button" onClick={remove} disabled={busy} className={btnDanger}>
                削除
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={btnGhost}>
              キャンセル
            </button>
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

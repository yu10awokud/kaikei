"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEditMode } from "@/components/EditModeProvider";
import { Field, Modal, btnDanger, btnGhost, btnPrimary, inputClass } from "@/components/ui/Modal";
import { EVENT_TYPE_LABEL, type EventRow, type EventType } from "@/lib/types";
import { trimSeconds } from "@/lib/date-utils";

/**
 * 予定の 追加 / 編集 / 削除 を行うモーダル。
 *
 * event が null なら「新規追加」、入っていれば「編集」として動きます。
 * 追加と編集はフォームの中身がほぼ同じなので、1つのコンポーネントにまとめています。
 */
export function EventDialog({
  date,
  event,
  onClose,
}: {
  date: string; // 'YYYY-MM-DD'
  event: EventRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const { editFetch } = useEditMode();

  const [form, setForm] = useState({
    date: event?.date ?? date,
    type: (event?.type ?? "practice") as EventType,
    title: event?.title ?? "",
    start_time: trimSeconds(event?.start_time ?? null),
    end_time: trimSeconds(event?.end_time ?? null),
    place: event?.place ?? "",
    memo: event?.memo ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 入力欄が多いので、1つの関数でまとめて更新できるようにしています
  const set = (key: keyof typeof form) => (v: string) =>
    setForm((prev) => ({ ...prev, [key]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await editFetch(
      event ? `/api/events/${event.id}` : "/api/events",
      { method: event ? "PATCH" : "POST", body: JSON.stringify(form) },
    );

    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "保存に失敗しました");
      return;
    }

    // router.refresh() で「サーバー側のページをもう一度取得し直す」。
    // Server Component が DB から読み直してくれるので、画面が最新になります。
    // 自分で state を書き換えて画面を更新するより、ズレが起きにくい方法です。
    router.refresh();
    onClose();
  }

  async function remove() {
    if (!event) return;
    if (!confirm(`「${event.title}」を削除します。よろしいですか？`)) return;

    setBusy(true);
    const res = await editFetch(`/api/events/${event.id}`, { method: "DELETE" });
    setBusy(false);

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "削除に失敗しました");
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal title={event ? "予定の編集" : "予定の追加"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="日付">
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => set("date")(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="種別">
          <div className="flex gap-2">
            {(Object.keys(EVENT_TYPE_LABEL) as EventType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set("type")(t)}
                className={[
                  "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition",
                  form.type === t
                    ? TYPE_ACTIVE_CLASS[t]
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
                ].join(" ")}
              >
                {EVENT_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="タイトル">
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => set("title")(e.target.value)}
            placeholder="例）通常練習"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="開始時刻">
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => set("start_time")(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="終了時刻">
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => set("end_time")(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="場所">
          <input
            type="text"
            value={form.place}
            onChange={(e) => set("place")(e.target.value)}
            placeholder="例）イリアス"
            className={inputClass}
          />
        </Field>

        <Field label="メモ">
          <textarea
            rows={2}
            value={form.memo}
            onChange={(e) => set("memo")(e.target.value)}
            className={inputClass}
          />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          <div>
            {event && (
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

const TYPE_ACTIVE_CLASS: Record<EventType, string> = {
  practice: "border-sky-600 bg-sky-600 text-white",
  event: "border-orange-500 bg-orange-500 text-white",
  off: "border-slate-500 bg-slate-500 text-white",
};

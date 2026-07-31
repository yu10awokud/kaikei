"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditMode } from "@/components/EditModeProvider";
import { Field, Modal, btnGhost, btnPrimary, inputClass } from "@/components/ui/Modal";
import { EVENT_TYPE_LABEL, WEEKDAY_LABEL, type EventRow, type EventType } from "@/lib/types";
import { datesOfWeekdayInMonth, formatShortJa, toDateString } from "@/lib/date-utils";

/**
 * 【曜日まとめ登録】
 *
 * 「2026年9月の火・木を全部 練習にする」といった一括作成を行います。
 *
 * 大事なのは "実行前のプレビュー"。
 * 作成される日付を、既存の予定とぶつかるかどうかも含めて先に見せます。
 * プレビューの計算に使う datesOfWeekdayInMonth() は、
 * サーバー側 (/api/events/bulk) が実際に使うのと同じ関数です。
 * 同じロジックを2か所に書くと必ずズレるので、共通化しています。
 */
export function BulkDialog({
  year,
  month,
  onClose,
}: {
  year: number;
  month: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const { editFetch } = useEditMode();

  const [ym, setYm] = useState(`${year}-${String(month).padStart(2, "0")}`);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [type, setType] = useState<EventType>("practice");
  const [title, setTitle] = useState("通常練習");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [place, setPlace] = useState("");
  const [memo, setMemo] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: string[]; skipped: string[]; deleted: number } | null>(null);

  const [targetYear, targetMonth] = ym.split("-").map(Number);

  /**
   * 対象年月を切り替えたら、その月の既存予定を取り直します。
   * （カレンダーが表示している月と、まとめ登録の対象月は別々に選べるため）
   *
   * useEffect は「描画が終わったあとに何かする」ための仕組みです。
   * 第2引数の [ym] は「ym が変わったら実行し直す」という意味。
   */
  const [monthEvents, setMonthEvents] = useState<EventRow[]>([]);
  useEffect(() => {
    // 画面を閉じた後に古いレスポンスが届いて上書きするのを防ぐためのフラグ
    let alive = true;
    const last = new Date(targetYear, targetMonth, 0).getDate();
    const mm = String(targetMonth).padStart(2, "0");
    fetch(`/api/events?from=${targetYear}-${mm}-01&to=${targetYear}-${mm}-${last}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: EventRow[]) => {
        if (alive) setMonthEvents(data);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [targetYear, targetMonth]);

  // 既に予定が入っている日付の一覧
  const occupied = useMemo(
    () => new Set(monthEvents.map((e) => e.date)),
    [monthEvents],
  );

  /**
   * useMemo は「依存する値が変わったときだけ計算し直す」ための仕組みです。
   * ここでは曜日や月を変えたときだけ再計算されます。
   * （毎回の再描画で計算し直しても動きますが、無駄が減り意図も伝わりやすくなります）
   */
  const preview = useMemo(() => {
    if (!targetYear || !targetMonth || weekdays.length === 0) return [];
    return weekdays
      .flatMap((w) => datesOfWeekdayInMonth(targetYear, targetMonth, w))
      .sort((a, b) => a.getTime() - b.getTime())
      .map((d) => ({ date: d, key: toDateString(d), conflict: occupied.has(toDateString(d)) }));
  }, [targetYear, targetMonth, weekdays, occupied]);

  const conflictCount = preview.filter((p) => p.conflict).length;

  function toggleWeekday(w: number) {
    setWeekdays((prev) =>
      prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w].sort(),
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await editFetch("/api/events/bulk", {
      method: "POST",
      body: JSON.stringify({
        year: targetYear,
        month: targetMonth,
        weekdays,
        type,
        title,
        start_time: startTime,
        end_time: endTime,
        place,
        memo,
        overwrite,
      }),
    });
    setBusy(false);

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "登録に失敗しました");
      return;
    }
    setResult(await res.json());
    router.refresh();
  }

  // 実行後は結果画面に切り替える
  if (result) {
    return (
      <Modal title="まとめ登録の結果" onClose={onClose} wide>
        <div className="space-y-3 text-sm">
          <p className="rounded-md bg-emerald-50 p-3 text-emerald-800">
            {result.created.length} 件の予定を作成しました。
            {result.deleted > 0 && `（既存の ${result.deleted} 件を上書き）`}
          </p>
          {result.skipped.length > 0 && (
            <p className="rounded-md bg-amber-50 p-3 text-amber-800">
              既に予定があったため {result.skipped.length} 件をスキップしました：
              <br />
              {result.skipped.join("、")}
            </p>
          )}
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={btnPrimary}>
              閉じる
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="曜日まとめ登録" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="対象年月">
            <input
              type="month"
              value={ym}
              onChange={(e) => setYm(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="種別">
            <div className="flex gap-2">
              {(Object.keys(EVENT_TYPE_LABEL) as EventType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={[
                    "flex-1 rounded-md border px-2 py-2 text-sm font-medium",
                    type === t
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {EVENT_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <Field label="曜日（複数選択できます）">
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_LABEL.map((label, w) => (
              <button
                key={w}
                type="button"
                onClick={() => toggleWeekday(w)}
                className={[
                  "h-10 w-10 rounded-md border text-sm font-bold transition",
                  weekdays.includes(w)
                    ? "border-sky-600 bg-sky-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="タイトル">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="開始時刻">
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
          </Field>
          <Field label="終了時刻">
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
          </Field>
          <Field label="場所">
            <input type="text" value={place} onChange={(e) => setPlace(e.target.value)} className={inputClass} />
          </Field>
        </div>

        <Field label="メモ">
          <textarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} className={inputClass} />
        </Field>

        {/* --- プレビュー --- */}
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-bold text-slate-700">
            作成される日付（{preview.length} 件）
          </h3>
          {preview.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">曜日を選ぶとここに一覧が出ます。</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {preview.map((p) => (
                <li
                  key={p.key}
                  className={[
                    "rounded px-2 py-1 text-xs",
                    p.conflict
                      ? "bg-amber-200 text-amber-900"
                      : "bg-white text-slate-700 ring-1 ring-slate-200",
                  ].join(" ")}
                  title={p.conflict ? "既に予定があります" : ""}
                >
                  {formatShortJa(p.date)}
                  {p.conflict && " ⚠"}
                </li>
              ))}
            </ul>
          )}

          {conflictCount > 0 && (
            <div className="mt-3 space-y-2 rounded-md bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">
                ⚠ が付いた {conflictCount} 件には既に予定があります。どうしますか？
              </p>
              <div className="flex flex-col gap-1.5 text-sm text-amber-900">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={!overwrite} onChange={() => setOverwrite(false)} />
                  その日はスキップする（既存の予定を残す）
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={overwrite} onChange={() => setOverwrite(true)} />
                  上書きする（既存の予定を削除して作り直す）
                </label>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            キャンセル
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || preview.length === 0 || title.trim() === ""}
            className={btnPrimary}
          >
            {busy ? "登録中…" : `${preview.length} 件を登録`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

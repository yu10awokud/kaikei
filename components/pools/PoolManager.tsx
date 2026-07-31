"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEditMode } from "@/components/EditModeProvider";
import { Field, Modal, btnDanger, btnGhost, btnPrimary, inputClass } from "@/components/ui/Modal";
import {
  METHOD_LABEL,
  RULE_TYPE_LABEL,
  WEEKDAY_LABEL,
  type BookingMethod,
  type PoolPriorityRow,
  type PoolRow,
  type RuleType,
} from "@/lib/types";
import {
  calcOpenDate,
  calcVisibleFrom,
  formatMonthJa,
  formatMonthRange,
  formatShortJa,
  upcomingTargetMonths,
} from "@/lib/date-utils";

/**
 * プールマスタ画面。
 * 施設ごとの「連絡先・受付ルール・手順メモ」と、曜日×季節の優先順位を管理します。
 */
export function PoolManager({
  pools,
  priorities,
}: {
  pools: PoolRow[];
  priorities: PoolPriorityRow[];
}) {
  const { enabled } = useEditMode();
  const [poolDialog, setPoolDialog] = useState<{ pool: PoolRow | null } | null>(null);
  const [prioDialog, setPrioDialog] = useState<{
    poolId: string;
    priority: PoolPriorityRow | null;
  } | null>(null);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">プールマスタ</h2>
        {enabled && (
          <button type="button" onClick={() => setPoolDialog({ pool: null })} className={btnPrimary}>
            ＋ プールを追加
          </button>
        )}
      </div>

      {!enabled && (
        <p className="mb-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
          閲覧モードです。編集するには右上の「編集モード」から合言葉を入力してください。
        </p>
      )}

      <div className="space-y-4">
        {pools.map((pool) => (
          <PoolCard
            key={pool.id}
            pool={pool}
            priorities={priorities.filter((p) => p.pool_id === pool.id)}
            editable={enabled}
            onEditPool={() => setPoolDialog({ pool })}
            onAddPriority={() => setPrioDialog({ poolId: pool.id, priority: null })}
            onEditPriority={(priority) => setPrioDialog({ poolId: pool.id, priority })}
          />
        ))}
      </div>

      {poolDialog && (
        <PoolDialog pool={poolDialog.pool} onClose={() => setPoolDialog(null)} />
      )}
      {prioDialog && (
        <PriorityDialog
          pools={pools}
          poolId={prioDialog.poolId}
          priority={prioDialog.priority}
          onClose={() => setPrioDialog(null)}
        />
      )}
    </div>
  );
}

/** プール1件分のカード */
function PoolCard({
  pool,
  priorities,
  editable,
  onEditPool,
  onAddPriority,
  onEditPriority,
}: {
  pool: PoolRow;
  priorities: PoolPriorityRow[];
  editable: boolean;
  onEditPool: () => void;
  onAddPriority: () => void;
  onEditPriority: (p: PoolPriorityRow) => void;
}) {
  return (
    <section
      className={[
        "rounded-lg border bg-white p-4 shadow-sm",
        pool.active ? "border-slate-200" : "border-slate-200 opacity-60",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold">
            {pool.name}
            {!pool.active && (
              <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
                停止中
              </span>
            )}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-bold text-sky-800">
              {METHOD_LABEL[pool.method]}
            </span>
            {pool.contact && <span>{pool.contact}</span>}
            {pool.staff_name && <span>担当: {pool.staff_name}</span>}
          </p>
        </div>
        {editable && (
          <button
            type="button"
            onClick={onEditPool}
            className="rounded px-2 py-1 text-sm text-sky-700 hover:bg-sky-50"
          >
            編集
          </button>
        )}
      </div>

      {/* --- 受付ルール --- */}
      <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
        <p>
          <span className="font-medium text-slate-700">受付ルール: </span>
          {describeRule(pool)}
        </p>
        <p className="text-slate-600">
          受付開始の <b>{pool.lead_days}日前</b> からTOPの要対応リストに表示します
        </p>

        {/* ルールを入れた結果が合っているか、その場で確認できるプレビュー */}
        <OpenDatePreview pool={pool} />
      </div>

      {/* --- 優先順位 --- */}
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-700">曜日 × 季節の優先順位</h4>
          {editable && (
            <button
              type="button"
              onClick={onAddPriority}
              className="rounded px-2 py-1 text-xs text-sky-700 hover:bg-sky-50"
            >
              ＋ 追加
            </button>
          )}
        </div>
        {priorities.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">登録なし</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {priorities.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded border border-slate-200 px-2 py-1.5 text-sm"
              >
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs font-bold text-white">
                  {WEEKDAY_LABEL[p.weekday]}曜
                </span>
                <span className="text-slate-600">
                  {formatMonthRange(p.start_month, p.end_month)}
                </span>
                <span className="font-bold text-sky-800">
                  {p.rank === 0 ? "順位0" : `第${p.rank}候補`}
                </span>
                {p.unlikely && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                    望み薄・一応確認
                  </span>
                )}
                {p.note && <span className="text-slate-500">{p.note}</span>}
                {editable && (
                  <button
                    type="button"
                    onClick={() => onEditPriority(p)}
                    className="ml-auto rounded px-2 py-0.5 text-xs text-sky-700 hover:bg-sky-50"
                  >
                    編集
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* --- 手順メモ（引き継ぎ書） --- */}
      {pool.manual && (
        <div className="mt-3">
          <h4 className="text-sm font-bold text-slate-700">手順メモ</h4>
          {/* preserve-newlines クラス（globals.css）で改行をそのまま表示します */}
          <p className="preserve-newlines mt-1 rounded-md bg-amber-50 p-3 text-sm text-slate-800">
            {pool.manual}
          </p>
        </div>
      )}
    </section>
  );
}

/** 受付ルールを日本語の文にする */
function describeRule(pool: PoolRow): string {
  if (pool.rule_type === "months_before" && pool.rule_value != null) {
    return `利用月の ${pool.rule_value}か月前の1日 から受付`;
  }
  if (pool.rule_type === "fixed_day" && pool.rule_value != null) {
    return `利用月の前月 ${pool.rule_value}日 が申込日・締切日`;
  }
  return RULE_TYPE_LABEL[pool.rule_type];
}

/**
 * 今後3か月ぶんの受付開始日プレビュー。
 * 「rule_type と rule_value を入れたら、実際いつになるのか」を
 * 保存直後にその場で確認できるようにするための表示です。
 */
function OpenDatePreview({ pool }: { pool: PoolRow }) {
  const months = upcomingTargetMonths();

  return (
    <div className="mt-2 border-t border-slate-200 pt-2">
      <p className="text-xs font-bold text-slate-500">今後3か月の受付開始日</p>
      <ul className="mt-1 space-y-0.5 text-sm">
        {months.map((m) => {
          const open = calcOpenDate(pool.rule_type, pool.rule_value, m);
          return (
            <li key={m} className="flex flex-wrap gap-x-3">
              <span className="w-24 shrink-0 text-slate-600">{formatMonthJa(m)}分</span>
              {open ? (
                <>
                  <span className="font-medium">{formatShortJa(open)} 受付開始</span>
                  <span className="text-slate-500">
                    （{formatShortJa(calcVisibleFrom(open, pool.lead_days))} からTOPに表示）
                  </span>
                </>
              ) : (
                <span className="text-amber-700">ルール未設定のため算出できません</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ============================================================
   プールの追加・編集ダイアログ
   ============================================================ */
function PoolDialog({ pool, onClose }: { pool: PoolRow | null; onClose: () => void }) {
  const router = useRouter();
  const { editFetch } = useEditMode();

  const [form, setForm] = useState({
    name: pool?.name ?? "",
    method: (pool?.method ?? "unknown") as BookingMethod,
    contact: pool?.contact ?? "",
    staff_name: pool?.staff_name ?? "",
    rule_type: (pool?.rule_type ?? "unknown") as RuleType,
    rule_value: pool?.rule_value != null ? String(pool.rule_value) : "",
    lead_days: String(pool?.lead_days ?? 7),
    manual: pool?.manual ?? "",
    active: pool?.active ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await editFetch(pool ? `/api/pools/${pool.id}` : "/api/pools", {
      method: pool ? "PATCH" : "POST",
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
    if (!pool) return;
    if (
      !confirm(
        `「${pool.name}」を削除します。\n紐づく優先順位と予約記録もすべて消えます。よろしいですか？`,
      )
    )
      return;
    setBusy(true);
    const res = await editFetch(`/api/pools/${pool.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("削除に失敗しました");
      return;
    }
    router.refresh();
    onClose();
  }

  // rule_value のラベルはルール種別によって意味が変わるので、文言も切り替えます
  const ruleValueLabel =
    form.rule_type === "months_before"
      ? "N（利用月の何か月前か）"
      : form.rule_type === "fixed_day"
        ? "N（前月の何日が申込日か）"
        : "N";

  return (
    <Modal title={pool ? "プールの編集" : "プールの追加"} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-3">
        <Field label="プール名">
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="予約方法">
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value as BookingMethod })}
              className={inputClass}
            >
              {(Object.keys(METHOD_LABEL) as BookingMethod[]).map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="連絡先" hint="電話番号やメールアドレス">
            <input
              type="text"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="担当者名">
          <input
            type="text"
            value={form.staff_name}
            onChange={(e) => setForm({ ...form, staff_name: e.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="受付開始ルール">
          <select
            value={form.rule_type}
            onChange={(e) => setForm({ ...form, rule_type: e.target.value as RuleType })}
            className={inputClass}
          >
            {(Object.keys(RULE_TYPE_LABEL) as RuleType[]).map((r) => (
              <option key={r} value={r}>
                {RULE_TYPE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          {form.rule_type !== "unknown" && (
            <Field label={ruleValueLabel}>
              <input
                type="number"
                min={form.rule_type === "fixed_day" ? 1 : 0}
                max={form.rule_type === "fixed_day" ? 31 : 24}
                value={form.rule_value}
                onChange={(e) => setForm({ ...form, rule_value: e.target.value })}
                className={inputClass}
              />
            </Field>
          )}
          <Field label="何日前からTOPに表示するか" hint="既定は7日前">
            <input
              type="number"
              min={0}
              max={180}
              value={form.lead_days}
              onChange={(e) => setForm({ ...form, lead_days: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="手順メモ（引き継ぎ書）" hint="改行はそのまま表示されます">
          <textarea
            rows={6}
            value={form.manual}
            onChange={(e) => setForm({ ...form, manual: e.target.value })}
            placeholder={"例）\n1. 受付開始日の朝9時に電話\n2. 「〇〇大学水泳部です」と伝える\n3. 希望日と人数を伝える"}
            className={inputClass}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="h-4 w-4 accent-sky-600"
          />
          このプールを使用中にする（外すと自動タスクに出なくなります）
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          <div>
            {pool && (
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

/* ============================================================
   優先順位の追加・編集ダイアログ
   ============================================================ */
function PriorityDialog({
  pools,
  poolId,
  priority,
  onClose,
}: {
  pools: PoolRow[];
  poolId: string;
  priority: PoolPriorityRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const { editFetch } = useEditMode();

  const [form, setForm] = useState({
    pool_id: priority?.pool_id ?? poolId,
    weekday: String(priority?.weekday ?? 2),
    start_month: String(priority?.start_month ?? 1),
    end_month: String(priority?.end_month ?? 12),
    rank: String(priority?.rank ?? 1),
    unlikely: priority?.unlikely ?? false,
    note: priority?.note ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sm = Number(form.start_month);
  const em = Number(form.end_month);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await editFetch(
      priority ? `/api/pool-priorities/${priority.id}` : "/api/pool-priorities",
      { method: priority ? "PATCH" : "POST", body: JSON.stringify(form) },
    );
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
    if (!priority) return;
    if (!confirm("この優先順位を削除します。よろしいですか？")) return;
    setBusy(true);
    const res = await editFetch(`/api/pool-priorities/${priority.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("削除に失敗しました");
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal title={priority ? "優先順位の編集" : "優先順位の追加"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="プール">
          <select
            value={form.pool_id}
            onChange={(e) => setForm({ ...form, pool_id: e.target.value })}
            className={inputClass}
          >
            {pools.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="曜日">
          <div className="flex gap-1">
            {WEEKDAY_LABEL.map((label, w) => (
              <button
                key={w}
                type="button"
                onClick={() => setForm({ ...form, weekday: String(w) })}
                className={[
                  "h-10 flex-1 rounded-md border text-sm font-bold",
                  Number(form.weekday) === w
                    ? "border-sky-600 bg-sky-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="開始月">
            <select
              value={form.start_month}
              onChange={(e) => setForm({ ...form, start_month: e.target.value })}
              className={inputClass}
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}月
                </option>
              ))}
            </select>
          </Field>
          <Field label="終了月">
            <select
              value={form.end_month}
              onChange={(e) => setForm({ ...form, end_month: e.target.value })}
              className={inputClass}
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}月
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* 年またぎになっていることを画面で明示する（設定ミスに気づけるように） */}
        <p className="rounded-md bg-slate-50 p-2 text-sm text-slate-600">
          対象: <b>{formatMonthRange(sm, em)}</b>
          {sm > em && (
            <span className="block text-xs text-slate-500">
              開始月 &gt; 終了月 なので、年をまたぐ期間として扱われます（
              {expandMonths(sm, em).join("・")}月）
            </span>
          )}
        </p>

        <Field
          label="順位"
          hint="小さいほど優先。0 は「望み薄だが一応確認する枠」として使います"
        >
          <input
            type="number"
            min={0}
            value={form.rank}
            onChange={(e) => setForm({ ...form, rank: e.target.value })}
            className={inputClass}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.unlikely}
            onChange={(e) => setForm({ ...form, unlikely: e.target.checked })}
            className="h-4 w-4 accent-amber-600"
          />
          望み薄（一応確認する程度）
        </label>

        <Field label="メモ">
          <input
            type="text"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="例）取れなければオフ"
            className={inputClass}
          />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          <div>
            {priority && (
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

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** 9〜4月 → [9,10,11,12,1,2,3,4] のように展開する（確認表示用） */
function expandMonths(start: number, end: number): number[] {
  const out: number[] = [];
  let m = start;
  for (let i = 0; i < 12; i++) {
    out.push(m);
    if (m === end) break;
    m = m === 12 ? 1 : m + 1;
  }
  return out;
}

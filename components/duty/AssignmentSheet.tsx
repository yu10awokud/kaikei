'use client';

import { useEffect, useMemo, useState } from 'react';
import MenuFiles from '@/components/duty/MenuFiles';
import { addDays, formatDateWithWeekday, monthRange, weekdayOf } from '@/lib/date';
import { getSeasonKeyFromDate, getSeasonRange } from '@/lib/season';
import type { AssignmentView, Member, Place, Slot } from '@/lib/types';

// ============================================================
// 割り当ての編集：ボトムシート型のモーダル
//   ・通常モード：担当者と場所をプルダウンで選ぶだけ（片方だけでも保存できる）
//   ・「二部練にする」トグルで午前・午後の 2 枠に分かれる
//   ・削除は論理削除。実行前に確認ダイアログを出す
// ============================================================

type Draft = { member_id: string; place_id: string; note: string };

const EMPTY: Draft = { member_id: '', place_id: '', note: '' };

function toDraft(a: AssignmentView | undefined): Draft {
  if (!a) return { ...EMPTY };
  return { member_id: a.member_id ?? '', place_id: a.place_id ?? '', note: a.note ?? '' };
}

/** 送信用に空文字を null へ変換 */
function toPayload(d: Draft) {
  return {
    member_id: d.member_id || null,
    place_id: d.place_id || null,
    note: d.note.trim() || null,
  };
}

export default function AssignmentSheet({
  dateKey,
  assignments,
  members,
  places,
  onClose,
  onSaved,
  onBulkAdded,
}: {
  dateKey: string;
  assignments: AssignmentView[];
  members: Member[];
  places: Place[];
  onClose: () => void;
  onSaved: (dateKey: string, assignments: AssignmentView[]) => void;
  onBulkAdded: (assignments: AssignmentView[]) => void;
}) {
  const bySlot = useMemo(() => {
    const map = new Map<Slot, AssignmentView>();
    for (const a of assignments) map.set(a.slot, a);
    return map;
  }, [assignments]);

  const hasSplit = bySlot.has('am') || bySlot.has('pm');

  const [split, setSplit] = useState(hasSplit);
  const [allDay, setAllDay] = useState<Draft>(toDraft(bySlot.get('all_day')));
  const [am, setAm] = useState<Draft>(toDraft(bySlot.get('am')));
  const [pm, setPm] = useState<Draft>(toDraft(bySlot.get('pm')));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 「この日以降、毎週この場所」用
  const [repeat, setRepeat] = useState(false);
  const [repeatUntil, setRepeatUntil] = useState<'month' | 'three' | 'season'>('month');
  const [result, setResult] = useState<string | null>(null);

  // 背面のスクロールを止める
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Esc キーで閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hasAnything = assignments.length > 0;

  /** 二部練トグルの切り替え */
  function toggleSplit(next: boolean) {
    if (next) {
      // 終日の内容を午前に引き継ぐ
      if (am.member_id === '' && am.place_id === '' && am.note === '') setAm({ ...allDay });
      setSplit(true);
      return;
    }
    // OFF に戻すときは、消えるデータがある場合だけ確認する
    const willLose =
      am.member_id || am.place_id || am.note || pm.member_id || pm.place_id || pm.note;
    if (willLose) {
      const okToDrop = window.confirm(
        '二部練をやめると、午前・午後に入力した内容は削除されます（あとから管理画面で復元できます）。よろしいですか？'
      );
      if (!okToDrop) return;
    }
    setSplit(false);
  }

  /** 「毎週」の終了日を求める */
  function repeatEndDate(): string {
    const [y, m] = dateKey.split('-').map(Number);
    if (repeatUntil === 'month') return monthRange(y, m).end;
    if (repeatUntil === 'three') {
      const total = y * 12 + (m - 1) + 3;
      return monthRange(Math.floor(total / 12), (total % 12) + 1).end;
    }
    return getSeasonRange(getSeasonKeyFromDate(dateKey)).end;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setResult(null);

    const body = split
      ? { date: dateKey, mode: 'split', am: toPayload(am), pm: toPayload(pm) }
      : { date: dateKey, mode: 'all_day', all_day: toPayload(allDay) };

    try {
      const res = await fetch('/api/assignments/day', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '保存に失敗しました。');
      onSaved(dateKey, json.assignments ?? []);

      // 「この日以降、毎週この場所」がONなら翌週以降にも場所だけ登録する
      if (repeat && !split && allDay.place_id) {
        const repeatRes = await fetch('/api/assignments/repeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start_date: addDays(dateKey, 7), // この日はすでに保存済みなので翌週から
            end_date: repeatEndDate(),
            place_id: allDay.place_id,
          }),
        });
        const repeatJson = await repeatRes.json();
        if (!repeatRes.ok) throw new Error(repeatJson.error ?? '毎週の登録に失敗しました。');
        onBulkAdded(repeatJson.assignments ?? []);
      }

      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const okToDelete = window.confirm(
      `${formatDateWithWeekday(dateKey)} の登録を削除します。\n（データは残るので、管理画面から復元できます）\nよろしいですか？`
    );
    if (!okToDelete) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/assignments/day', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateKey, mode: 'all_day', all_day: null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '削除に失敗しました。');
      onSaved(dateKey, json.assignments ?? []);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${dateKey} の割り当て`}
    >
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 pb-6 shadow-xl sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* つまみ（スマホでボトムシートらしく見せる） */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />

        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-ink">{formatDateWithWeekday(dateKey)}</h3>
          <button type="button" onClick={onClose} className="px-2 py-1 text-sm text-ink-faint">
            閉じる
          </button>
        </div>

        {/* 二部練トグル */}
        <label className="mb-4 flex items-center justify-between rounded-card bg-aqua-50 px-3.5 py-3">
          <span className="text-sm font-bold">二部練にする（午前・午後）</span>
          <input
            type="checkbox"
            checked={split}
            onChange={(e) => toggleSplit(e.target.checked)}
            className="h-5 w-5 accent-aqua-600"
          />
        </label>

        {split ? (
          <div className="space-y-4">
            <SlotFields title="午前" draft={am} setDraft={setAm} members={members} places={places} />
            <SlotFields title="午後" draft={pm} setDraft={setPm} members={members} places={places} />
          </div>
        ) : (
          <SlotFields draft={allDay} setDraft={setAllDay} members={members} places={places} />
        )}

        {/* 練習場所を選んだときだけ出る「毎週まとめて登録」 */}
        {!split && allDay.place_id && (
          <div className="mt-4 rounded-card border border-line bg-line-soft px-3.5 py-3">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={repeat}
                onChange={(e) => setRepeat(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-aqua-600"
              />
              <span className="text-sm">
                <span className="font-bold">
                  この日以降、毎週{weekdayOf(dateKey)}曜日に同じ場所を登録する
                </span>
                <span className="mt-0.5 block text-xs text-ink-faint">
                  練習場所だけを入れます（担当者は「未定」のまま）。すでに登録がある日はそのままです。
                </span>
              </span>
            </label>

            {repeat && (
              <div className="mt-2.5 pl-7">
                <label className="mb-1 block text-xs font-medium text-ink-faint">どこまで登録する？</label>
                <select
                  className="field"
                  value={repeatUntil}
                  onChange={(e) => setRepeatUntil(e.target.value as 'month' | 'three' | 'season')}
                >
                  <option value="month">今月末まで</option>
                  <option value="three">3か月先の月末まで</option>
                  <option value="season">今シーズンの終わり（8/31）まで</option>
                </select>
                <p className="mt-1.5 text-xs text-ink-faint">
                  例外の日は、あとからその日をタップして削除・変更できます。
                </p>
              </div>
            )}
          </div>
        )}

        {/* その日のメニューPDF */}
        <MenuFiles dateKey={dateKey} />

        {result && (
          <p className="mt-3 rounded-card border border-line bg-aqua-50 px-3 py-2 text-sm">{result}</p>
        )}

        {error && (
          <p className="mt-3 rounded-card border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="mt-5 space-y-2">
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary w-full">
            {saving ? '保存中…' : '保存する'}
          </button>

          {hasAnything && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="w-full rounded-full border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-600 tap"
            >
              この日の登録を削除
            </button>
          )}
        </div>

        <p className="mt-3 text-center text-[11px] text-ink-faint">
          担当者・場所は片方だけでも保存できます（未選択は「未定」になります）
        </p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// 1 枠ぶんの入力欄（担当者 / 場所 / メモ）
// ------------------------------------------------------------
function SlotFields({
  title,
  draft,
  setDraft,
  members,
  places,
}: {
  title?: string;
  draft: Draft;
  setDraft: (d: Draft) => void;
  members: Member[];
  places: Place[];
}) {
  // 「オフ」の場所が選ばれているか
  const isOff = places.some((p) => p.id === draft.place_id && p.is_off);

  return (
    <div className={title ? 'rounded-card border border-line p-3.5' : ''}>
      {title && <div className="mb-2 text-sm font-bold text-ink-soft">{title}</div>}

      <div className="space-y-3">
        {/* オフの日は担当者を選ぶ必要がないので隠す */}
        {!isOff && (
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-faint">担当者</label>
            <select
              className="field"
              value={draft.member_id}
              onChange={(e) => setDraft({ ...draft, member_id: e.target.value })}
            >
              <option value="">未定</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-faint">練習場所</label>
          <select
            className="field"
            value={draft.place_id}
            onChange={(e) => {
              const nextId = e.target.value;
              const nextIsOff = places.some((p) => p.id === nextId && p.is_off);
              // オフに変えたときは担当者を外す
              setDraft({ ...draft, place_id: nextId, member_id: nextIsOff ? '' : draft.member_id });
            }}
          >
            <option value="">未定</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-faint">メモ（任意）</label>
          <input
            type="text"
            className="field"
            value={draft.note}
            placeholder="例：合宿、記録会など"
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

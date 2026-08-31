import {
  ok, fail, requireClient, readJson, isDateKey, isUuidOrNull, cleanText,
  toMessage, ASSIGNMENT_SELECT,
} from '@/lib/api-helpers';
import type { Slot } from '@/lib/types';

export const dynamic = 'force-dynamic';

// ============================================================
// PUT /api/assignments/day
//   「その日をこういう状態にしてください」とまとめて送る API。
//   編集モーダルの保存ボタンはこれ 1 本を呼ぶ。
//
//   body の例（通常モード）:
//     { date: '2026-08-22', mode: 'all_day',
//       all_day: { member_id: '...', place_id: '...', note: null } }
//
//   body の例（二部練）:
//     { date: '2026-08-22', mode: 'split',
//       am: { member_id: '...', place_id: null },
//       pm: { member_id: null,   place_id: '...' } }
//
//   ・モードを切り替えると、反対側の枠は論理削除される
//   ・担当者も場所も未選択（両方 null）の枠は論理削除される
//   ・これにより「終日と午前/午後の同居」は構造的に起きない
// ============================================================

type Entry = {
  member_id: string | null;
  custom_member: string | null;
  place_id: string | null;
  note: string | null;
};

function parseEntry(value: unknown): Entry | null | 'invalid' {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return 'invalid';

  const v = value as Record<string, unknown>;
  if (!isUuidOrNull(v.member_id) || !isUuidOrNull(v.place_id)) return 'invalid';

  const member_id = (v.member_id as string | null) ?? null;
  const custom_member = cleanText(v.custom_member, 40);
  const place_id = (v.place_id as string | null) ?? null;
  const note = cleanText(v.note);

  // 担当者も場所も未選択なら「その枠は無し」とみなす
  if (member_id === null && custom_member === null && place_id === null && note === null) {
    return null;
  }
  // 部員を選んだときは自由記述の名前は残さない
  return { member_id, custom_member: member_id ? null : custom_member, place_id, note };
}

export async function PUT(req: Request) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const body = await readJson(req);
  const date = body.date;
  const mode = body.mode;

  if (!isDateKey(date)) return fail('日付の形式が正しくありません（YYYY-MM-DD）。');
  if (mode !== 'all_day' && mode !== 'split') return fail('mode は all_day か split を指定してください。');

  // 先に中身を検証してから「あるべき状態」を組み立てる
  const parsed: Partial<Record<Slot, Entry | null>> = {};
  for (const slot of ['all_day', 'am', 'pm'] as Slot[]) {
    const result = parseEntry(body[slot]);
    if (result === 'invalid') return fail('担当者・場所の指定が正しくありません。');
    parsed[slot] = result;
  }

  const wanted: Record<Slot, Entry | null> =
    mode === 'all_day'
      ? { all_day: parsed.all_day ?? null, am: null, pm: null }
      : { all_day: null, am: parsed.am ?? null, pm: parsed.pm ?? null };

  // 現在その日にある「生きている」レコードを取得
  const { data: current, error: readError } = await supabase
    .from('assignments')
    .select('id, slot')
    .eq('date', date)
    .eq('is_deleted', false);

  if (readError) return fail(toMessage(readError), 500);

  const existing = new Map<Slot, string>();
  for (const row of current ?? []) existing.set(row.slot as Slot, row.id as string);

  // 1) いらなくなった枠を先に論理削除する
  //    （先に消しておかないと「終日 と 午前/午後 の同居」チェックに引っかかる）
  const toDelete: string[] = [];
  for (const [slot, id] of existing) {
    if (!wanted[slot]) toDelete.push(id);
  }
  if (toDelete.length > 0) {
    const { error } = await supabase.from('assignments').update({ is_deleted: true }).in('id', toDelete);
    if (error) return fail(toMessage(error), 400);
  }

  // 2) 残す枠を作成 or 更新する
  for (const slot of ['all_day', 'am', 'pm'] as Slot[]) {
    const entry = wanted[slot];
    if (!entry) continue;

    const id = existing.get(slot);
    if (id) {
      const { error } = await supabase.from('assignments').update(entry).eq('id', id);
      if (error) return fail(toMessage(error), 400);
    } else {
      const { error } = await supabase.from('assignments').insert({ date, slot, ...entry });
      if (error) return fail(toMessage(error), 400);
    }
  }

  // 3) 保存後のその日の状態を返す（画面はこれを使って再読み込みなしで更新する）
  const { data, error } = await supabase
    .from('assignments')
    .select(ASSIGNMENT_SELECT)
    .eq('date', date)
    .eq('is_deleted', false)
    .order('slot', { ascending: true });

  if (error) return fail(toMessage(error), 500);
  return ok({ date, assignments: data ?? [] });
}

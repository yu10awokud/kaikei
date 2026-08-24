import {
  ok, fail, requireClient, readJson, isDateKey, isSlot, isUuidOrNull, cleanText,
  toMessage, ASSIGNMENT_SELECT,
} from '@/lib/api-helpers';

// 常に最新のデータを返す（キャッシュしない）
export const dynamic = 'force-dynamic';

// ------------------------------------------------------------
// GET /api/assignments
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD  期間で絞り込み（省略可）
//   ?deleted=1                       論理削除済みだけを返す（管理画面用）
// ------------------------------------------------------------
export async function GET(req: Request) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const deleted = url.searchParams.get('deleted') === '1';

  let query = supabase
    .from('assignments')
    .select(ASSIGNMENT_SELECT)
    .eq('is_deleted', deleted)
    .order('date', { ascending: true })
    .order('slot', { ascending: true });

  if (from && isDateKey(from)) query = query.gte('date', from);
  if (to && isDateKey(to)) query = query.lte('date', to);

  const { data, error } = await query;
  if (error) return fail(toMessage(error), 500);
  return ok({ assignments: data ?? [] });
}

// ------------------------------------------------------------
// POST /api/assignments  1 件追加
// ------------------------------------------------------------
export async function POST(req: Request) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const body = await readJson(req);
  const { date, member_id = null, place_id = null, note } = body;
  const slot = body.slot ?? 'all_day';

  if (!isDateKey(date)) return fail('日付の形式が正しくありません（YYYY-MM-DD）。');
  if (!isSlot(slot)) return fail('枠の指定が正しくありません（all_day / am / pm）。');
  if (!isUuidOrNull(member_id) || !isUuidOrNull(place_id)) return fail('担当者・場所の指定が正しくありません。');
  if (member_id === null && place_id === null) {
    return fail('担当者か練習場所のどちらか一方は選んでください。');
  }

  const { data, error } = await supabase
    .from('assignments')
    .insert({ date, slot, member_id, place_id, note: cleanText(note) })
    .select(ASSIGNMENT_SELECT)
    .single();

  if (error) return fail(toMessage(error), 400);
  return ok({ assignment: data });
}

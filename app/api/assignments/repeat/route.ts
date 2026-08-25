import {
  ok, fail, requireClient, readJson, isDateKey, isUuidOrNull, toMessage, ASSIGNMENT_SELECT,
} from '@/lib/api-helpers';
import { addDays } from '@/lib/date';

export const dynamic = 'force-dynamic';

// ============================================================
// POST /api/assignments/repeat
//   「この日から毎週、同じ曜日に練習場所だけ登録する」ための API。
//
//   body 例:
//     { start_date: '2026-09-01', end_date: '2026-12-31', place_id: '...' }
//
//   ・登録するのは練習場所だけ。担当者は必ず未定（null）で入れる
//   ・すでに登録がある日は上書きせず飛ばす
//     （例外の日は後から個別に直せるようにするため）
// ============================================================

/** 一度に登録できる上限（暴発防止） */
const MAX_WEEKS = 60;

export async function POST(req: Request) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const body = await readJson(req);
  const { start_date, end_date, place_id } = body;

  if (!isDateKey(start_date)) return fail('開始日の形式が正しくありません。');
  if (!isDateKey(end_date)) return fail('終了日の形式が正しくありません。');
  if (end_date < start_date) return fail('終了日は開始日より後にしてください。');
  if (!isUuidOrNull(place_id) || !place_id) return fail('練習場所を選んでください。');

  // 開始日から 7 日ずつ進めて対象日を作る
  const targets: string[] = [];
  for (let d = start_date; d <= end_date; d = addDays(d, 7)) {
    targets.push(d);
    if (targets.length > MAX_WEEKS) {
      return fail(`一度に登録できるのは ${MAX_WEEKS} 週までです。期間を短くしてください。`);
    }
  }
  if (targets.length === 0) return fail('登録対象の日がありません。');

  // すでに登録がある日は飛ばす（終日・午前・午後のどれかがあれば対象外）
  const { data: existing, error: readError } = await supabase
    .from('assignments')
    .select('date')
    .eq('is_deleted', false)
    .in('date', targets);

  if (readError) return fail(toMessage(readError), 500);

  const taken = new Set((existing ?? []).map((row) => row.date as string));
  const toInsert = targets.filter((d) => !taken.has(d));

  if (toInsert.length === 0) {
    return ok({ assignments: [], created: 0, skipped: targets.length });
  }

  const { data, error } = await supabase
    .from('assignments')
    .insert(
      toInsert.map((date) => ({
        date,
        slot: 'all_day',
        member_id: null, // 担当者は未定のまま
        place_id,
        note: null,
      }))
    )
    .select(ASSIGNMENT_SELECT);

  if (error) return fail(toMessage(error), 400);

  return ok({
    assignments: data ?? [],
    created: toInsert.length,
    skipped: targets.length - toInsert.length,
  });
}

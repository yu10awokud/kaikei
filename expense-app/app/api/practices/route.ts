import { ok, fail, requireClient, isDateKey, toMessage } from '@/lib/api-helpers';
import type { Practice, Slot } from '@/lib/types';

// 練習予定は「DBにコピーしない・毎回取りに行く」のでキャッシュしない
export const dynamic = 'force-dynamic';

// 既存カレンダーから読むのは「日付」「枠」「練習場所」だけ。
// メニュー担当者（member）は select にも含めない。
const PRACTICE_SELECT = 'id, date, slot, place:places(name, color, is_off)';

type PlaceRow = { name: string; color: string; is_off: boolean };

type Row = {
  id: string;
  date: string;
  slot: Slot;
  // Supabase の型推論では配列にも単体にもなり得るので、両方受けられるようにする
  place: PlaceRow | PlaceRow[] | null;
};

/** 参照先の place を 1 件に正規化する */
function pickPlace(place: Row['place']) {
  if (Array.isArray(place)) return place[0] ?? null;
  return place;
}

// ------------------------------------------------------------
// GET /api/practices?from=YYYY-MM-DD&to=YYYY-MM-DD
//   既存サイトと同じ Supabase の assignments / places を毎回読む。
//   このアプリは既存テーブルへの書き込みを一切行わない（読み取り専用）。
// ------------------------------------------------------------
export async function GET(req: Request) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  if (from && !isDateKey(from)) return fail('from の日付の形式が正しくありません。');
  if (to && !isDateKey(to)) return fail('to の日付の形式が正しくありません。');

  let query = supabase
    .from('assignments')
    .select(PRACTICE_SELECT)
    .eq('is_deleted', false)
    .order('date', { ascending: false })
    .order('slot', { ascending: true });

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);

  const { data, error } = await query;
  if (error) return fail(toMessage(error), 502);

  const practices: Practice[] = ((data ?? []) as unknown as Row[]).map((row) => {
    const place = pickPlace(row.place);
    return {
      id: row.id,
      date: row.date,
      slot: row.slot,
      location: place?.name ?? '場所未定',
      color: place?.color ?? '#C9D2DA',
      isOff: place?.is_off ?? false,
    };
  });

  return ok({ practices });
}

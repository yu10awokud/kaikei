import { ok, fail, requireClient, readJson, isHexColor, cleanText, toMessage } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const TABLE = 'places';
const LABEL = '練習場所';

// ------------------------------------------------------------
// GET /api/places   一覧（在籍/有効でないものも含めて全部返す）
// ------------------------------------------------------------
export async function GET() {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return fail(toMessage(error), 500);
  return ok({ places: data ?? [] });
}

// ------------------------------------------------------------
// POST /api/places   追加
// ------------------------------------------------------------
export async function POST(req: Request) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const body = await readJson(req);
  const name = cleanText(body.name, 50);
  if (!name) return fail(LABEL + 'の名前を入力してください。');

  const color = isHexColor(body.color) ? body.color : '#888888';

  // 並び順は末尾に置く
  const { data: last } = await supabase
    .from(TABLE)
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  const sortOrder = (last?.[0]?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ name, color, sort_order: sortOrder, is_active: true })
    .select('*')
    .single();

  if (error) return fail(toMessage(error), 400);
  return ok({ item: data });
}

// ------------------------------------------------------------
// PUT /api/places   並び替え（{ ids: [...] } を先頭から 1,2,3... に振り直す）
// ------------------------------------------------------------
export async function PUT(req: Request) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const body = await readJson(req);
  const ids = body.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return fail('並び順の指定が正しくありません。');
  }

  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase.from(TABLE).update({ sort_order: i + 1 }).eq('id', ids[i]);
    if (error) return fail(toMessage(error), 400);
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return fail(toMessage(error), 500);
  return ok({ places: data ?? [] });
}

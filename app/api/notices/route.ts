import { ok, fail, requireClient, readJson, toMessage } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const SELECT = 'id, body, is_visible, sort_order, created_at, updated_at';

// ------------------------------------------------------------
// GET /api/notices   一覧（非表示のものも含む。管理画面用）
// ------------------------------------------------------------
export async function GET() {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const { data, error } = await supabase
    .from('notices')
    .select(SELECT)
    .order('sort_order')
    .order('created_at');

  if (error) return fail(toMessage(error), 500);
  return ok({ notices: data ?? [] });
}

// ------------------------------------------------------------
// POST /api/notices   追加
// ------------------------------------------------------------
export async function POST(req: Request) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const body = await readJson(req);
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 1000) : '';
  if (!text) return fail('お知らせの内容を入力してください。');

  // 並び順は末尾に置く
  const { data: last } = await supabase
    .from('notices')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  const sortOrder = (last?.[0]?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from('notices')
    .insert({ body: text, is_visible: true, sort_order: sortOrder })
    .select(SELECT)
    .single();

  if (error) return fail(toMessage(error), 400);
  return ok({ notice: data });
}

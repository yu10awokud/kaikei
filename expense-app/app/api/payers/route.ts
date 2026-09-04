import { ok, fail, requireClient, readJson, cleanText, isUuid, toMessage } from '@/lib/api-helpers';
import type { Payer } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PAYER_SELECT = 'id, name, is_active, sort_order, created_at, updated_at';

// ------------------------------------------------------------
// GET /api/payers
//   ?active=1 … 入力画面のプルダウン用に、有効な人だけ返す
//   このアプリ専用の立替者マスタ。既存サイトの部員マスタとは別物。
// ------------------------------------------------------------
export async function GET(req: Request) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const onlyActive = new URL(req.url).searchParams.get('active') === '1';

  let query = supabase
    .from('payers')
    .select(PAYER_SELECT)
    .order('sort_order')
    .order('created_at');
  if (onlyActive) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) return fail(toMessage(error), 502);

  return ok({ payers: (data ?? []) as Payer[] });
}

// ------------------------------------------------------------
// POST /api/payers   立替者を1人追加する
// ------------------------------------------------------------
export async function POST(req: Request) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const body = await readJson(req);
  const name = cleanText(body.name, 40);
  if (!name) return fail('名前を入力してください。');

  // 並び順は、いまある人の一番うしろに付ける
  const { data: last } = await supabase
    .from('payers')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from('payers')
    .insert({ name, sort_order: (last?.sort_order ?? 0) + 1 })
    .select(PAYER_SELECT)
    .single();

  if (error) return fail(toMessage(error), 400);
  return ok({ payer: data });
}

// ------------------------------------------------------------
// PUT /api/payers   並び順をまとめて保存する
//   { ids: [...] } の順番どおりに sort_order を振り直す
// ------------------------------------------------------------
export async function PUT(req: Request) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const body = await readJson(req);
  const ids = Array.isArray(body.ids) ? body.ids.filter(isUuid) : null;
  if (!ids || ids.length === 0) return fail('並び順の指定が正しくありません。');

  // 1件ずつ順番を書き込む（人数はせいぜい数十人なので十分速い）
  for (const [index, id] of ids.entries()) {
    const { error } = await supabase.from('payers').update({ sort_order: index }).eq('id', id);
    if (error) return fail(toMessage(error), 400);
  }

  return ok({ ids });
}

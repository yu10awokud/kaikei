import { ok, fail, requireClient, readJson, cleanText, isUuid, toMessage } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const PAYER_SELECT = 'id, name, is_active, sort_order, created_at, updated_at';

type Params = { params: Promise<{ id: string }> };

// ------------------------------------------------------------
// PATCH /api/payers/[id]   名前の変更・表示/非表示の切り替え
// ------------------------------------------------------------
export async function PATCH(req: Request, { params }: Params) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const { id } = await params;
  if (!isUuid(id)) return fail('立替者の指定が正しくありません。');

  const body = await readJson(req);
  const patch: Record<string, unknown> = {};

  if ('name' in body) {
    const name = cleanText(body.name, 40);
    if (!name) return fail('名前を入力してください。');
    patch.name = name;
  }
  if ('is_active' in body) {
    if (typeof body.is_active !== 'boolean') return fail('表示の指定が正しくありません。');
    patch.is_active = body.is_active;
  }
  if (Object.keys(patch).length === 0) return fail('変更する内容がありません。');

  const { data, error } = await supabase
    .from('payers')
    .update(patch)
    .eq('id', id)
    .select(PAYER_SELECT)
    .maybeSingle();

  if (error) return fail(toMessage(error), 400);
  if (!data) return fail('その立替者は見つかりませんでした。', 404);
  return ok({ payer: data });
}

// ------------------------------------------------------------
// DELETE /api/payers/[id]   立替者を削除する
//   過去の立替の記録は消えない。記録には名前が控えてあるので、
//   紐付けだけが外れて、名前はそのまま画面に残る。
// ------------------------------------------------------------
export async function DELETE(_req: Request, { params }: Params) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const { id } = await params;
  if (!isUuid(id)) return fail('立替者の指定が正しくありません。');

  // 画面に「この人の記録が何件あるか」を出せるよう、件数を数えてから消す
  const { count } = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('payer_id', id)
    .eq('is_deleted', false);

  const { data, error } = await supabase
    .from('payers')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) return fail(toMessage(error), 400);
  if (!data) return fail('その立替者は見つかりませんでした。', 404);
  return ok({ id, keptExpenses: count ?? 0 });
}

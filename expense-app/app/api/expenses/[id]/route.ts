import {
  ok, fail, requireClient, readJson, isUuid,
  validateExpenseInput, toMessage, EXPENSE_SELECT,
} from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// ------------------------------------------------------------
// PATCH /api/expenses/[id]
//   ・{ status: 'settled' | 'unsettled' } … 精算チェックの切り替え
//   ・それ以外のときは、立替の内容をまるごと更新する
// ------------------------------------------------------------
export async function PATCH(req: Request, { params }: Params) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const { id } = await params;
  if (!isUuid(id)) return fail('立替の指定が正しくありません。');

  const body = await readJson(req);

  // 精算チェックだけを切り替える場合
  if (Object.keys(body).length === 1 && 'status' in body) {
    const status = body.status;
    if (status !== 'settled' && status !== 'unsettled') {
      return fail('精算状況の指定が正しくありません。');
    }
    const { data, error } = await supabase
      .from('expenses')
      .update({ status, settled_at: status === 'settled' ? new Date().toISOString() : null })
      .eq('id', id)
      .eq('is_deleted', false)
      .select(EXPENSE_SELECT)
      .maybeSingle();

    if (error) return fail(toMessage(error), 400);
    if (!data) return fail('その立替は見つかりませんでした。', 404);
    return ok({ expense: data });
  }

  // 内容をまるごと更新する場合
  const { value, error: invalid } = validateExpenseInput(body);
  if (invalid || !value) return fail(invalid ?? '入力内容が正しくありません。');

  const { data, error } = await supabase
    .from('expenses')
    .update({
      ...value,
      settled_at: value.status === 'settled' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .eq('is_deleted', false)
    .select(EXPENSE_SELECT)
    .maybeSingle();

  if (error) return fail(toMessage(error), 400);
  if (!data) return fail('その立替は見つかりませんでした。', 404);
  return ok({ expense: data });
}

// ------------------------------------------------------------
// DELETE /api/expenses/[id]
//   物理削除はせず is_deleted = true にする（誤操作で消えないように）。
//   領収書の画像もストレージに残したままにする。
// ------------------------------------------------------------
export async function DELETE(_req: Request, { params }: Params) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const { id } = await params;
  if (!isUuid(id)) return fail('立替の指定が正しくありません。');

  const { data, error } = await supabase
    .from('expenses')
    .update({ is_deleted: true })
    .eq('id', id)
    .eq('is_deleted', false)
    .select('id')
    .maybeSingle();

  if (error) return fail(toMessage(error), 400);
  if (!data) return fail('その立替は見つかりませんでした。', 404);
  return ok({ id });
}

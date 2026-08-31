import { ok, fail, requireClient, readJson, toMessage } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const SELECT = 'id, body, is_visible, sort_order, created_at, updated_at';

type Ctx = { params: Promise<{ id: string }> };

// ------------------------------------------------------------
// PATCH /api/notices/[id]   本文の変更・表示のオンオフ
// ------------------------------------------------------------
export async function PATCH(req: Request, { params }: Ctx) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const { id } = await params;
  if (!id) return fail('ID が正しくありません。');

  const body = await readJson(req);
  const patch: Record<string, unknown> = {};

  if ('body' in body) {
    const text = typeof body.body === 'string' ? body.body.trim().slice(0, 1000) : '';
    if (!text) return fail('お知らせの内容を入力してください。');
    patch.body = text;
  }
  if ('is_visible' in body) patch.is_visible = Boolean(body.is_visible);
  if ('sort_order' in body) {
    const n = Number(body.sort_order);
    if (!Number.isInteger(n)) return fail('並び順は整数で指定してください。');
    patch.sort_order = n;
  }

  if (Object.keys(patch).length === 0) return fail('変更する項目がありません。');

  const { data, error } = await supabase
    .from('notices')
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .single();

  if (error) return fail(toMessage(error), 400);
  return ok({ notice: data });
}

// ------------------------------------------------------------
// DELETE /api/notices/[id]   完全に削除する
//   （表示を消したいだけなら is_visible を false にする）
// ------------------------------------------------------------
export async function DELETE(_req: Request, { params }: Ctx) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const { id } = await params;
  if (!id) return fail('ID が正しくありません。');

  const { error } = await supabase.from('notices').delete().eq('id', id);
  if (error) return fail(toMessage(error), 400);
  return ok({ id });
}

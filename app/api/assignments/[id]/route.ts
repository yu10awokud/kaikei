import {
  ok, fail, requireClient, readJson, isUuidOrNull, cleanText, toMessage, ASSIGNMENT_SELECT,
} from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// ------------------------------------------------------------
// PATCH /api/assignments/[id]
//   担当者・場所・メモの変更、および復元（is_deleted: false）
// ------------------------------------------------------------
export async function PATCH(req: Request, { params }: Ctx) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const { id } = await params;
  if (!isUuidOrNull(id) || !id) return fail('ID が正しくありません。');

  const body = await readJson(req);
  const patch: Record<string, unknown> = {};

  if ('member_id' in body) {
    if (!isUuidOrNull(body.member_id)) return fail('担当者の指定が正しくありません。');
    patch.member_id = body.member_id ?? null;
  }
  if ('place_id' in body) {
    if (!isUuidOrNull(body.place_id)) return fail('練習場所の指定が正しくありません。');
    patch.place_id = body.place_id ?? null;
  }
  if ('note' in body) patch.note = cleanText(body.note);
  if ('is_deleted' in body) patch.is_deleted = Boolean(body.is_deleted);

  if (Object.keys(patch).length === 0) return fail('変更する項目がありません。');

  const { data, error } = await supabase
    .from('assignments')
    .update(patch)
    .eq('id', id)
    .select(ASSIGNMENT_SELECT)
    .single();

  if (error) return fail(toMessage(error), 400);
  return ok({ assignment: data });
}

// ------------------------------------------------------------
// DELETE /api/assignments/[id]
//   物理削除はしない。is_deleted = true にする（論理削除）
// ------------------------------------------------------------
export async function DELETE(_req: Request, { params }: Ctx) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const { id } = await params;
  if (!id) return fail('ID が正しくありません。');

  const { error } = await supabase
    .from('assignments')
    .update({ is_deleted: true })
    .eq('id', id);

  if (error) return fail(toMessage(error), 400);
  return ok({ id, is_deleted: true });
}

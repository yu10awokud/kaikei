import { ok, fail, requireClient, readJson, isDateKey, cleanText, toMessage } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const SELECT = 'id, version, released_on, category, notes, author, is_deleted, created_at, updated_at';

type Ctx = { params: Promise<{ id: string }> };

// ------------------------------------------------------------
// PATCH /api/releases/[id]   編集
// ------------------------------------------------------------
export async function PATCH(req: Request, { params }: Ctx) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const { id } = await params;
  if (!id) return fail('ID が正しくありません。');

  const body = await readJson(req);
  const patch: Record<string, unknown> = {};

  if ('version' in body) {
    const version = cleanText(body.version, 40);
    if (!version) return fail('バージョン名を入力してください。');
    patch.version = version;
  }
  if ('released_on' in body) {
    if (!isDateKey(body.released_on)) return fail('日付の形式が正しくありません（YYYY-MM-DD）。');
    patch.released_on = body.released_on;
  }
  if ('category' in body) patch.category = body.category === 'fix' ? 'fix' : 'major';
  if ('notes' in body) patch.notes = typeof body.notes === 'string' ? body.notes.slice(0, 2000) : '';
  if ('author' in body) patch.author = cleanText(body.author, 40) ?? '';

  if (Object.keys(patch).length === 0) return fail('変更する項目がありません。');

  const { data, error } = await supabase
    .from('releases')
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .single();

  if (error) return fail(toMessage(error), 400);
  return ok({ release: data });
}

// ------------------------------------------------------------
// DELETE /api/releases/[id]   論理削除
// ------------------------------------------------------------
export async function DELETE(_req: Request, { params }: Ctx) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const { id } = await params;
  if (!id) return fail('ID が正しくありません。');

  const { error } = await supabase.from('releases').update({ is_deleted: true }).eq('id', id);
  if (error) return fail(toMessage(error), 400);
  return ok({ id, is_deleted: true });
}

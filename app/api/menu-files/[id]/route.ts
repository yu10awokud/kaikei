import { ok, fail, requireClient, readJson, toMessage } from '@/lib/api-helpers';
import { menuFileUrl } from '@/lib/queries';

export const dynamic = 'force-dynamic';

const SELECT = 'id, date, file_name, storage_path, size_bytes, note, is_deleted, created_at, updated_at';

type Ctx = { params: Promise<{ id: string }> };

// ------------------------------------------------------------
// PATCH /api/menu-files/[id]
//   復元（is_deleted: false）やメモの変更に使う
// ------------------------------------------------------------
export async function PATCH(req: Request, { params }: Ctx) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const { id } = await params;
  if (!id) return fail('ID が正しくありません。');

  const body = await readJson(req);
  const patch: Record<string, unknown> = {};
  if ('is_deleted' in body) patch.is_deleted = Boolean(body.is_deleted);
  if ('note' in body) patch.note = typeof body.note === 'string' ? body.note.trim() || null : null;

  if (Object.keys(patch).length === 0) return fail('変更する項目がありません。');

  const { data, error } = await supabase
    .from('menu_files')
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .single();

  if (error) return fail(toMessage(error), 400);
  return ok({ file: { ...data, url: menuFileUrl(data.storage_path as string) } });
}

// ------------------------------------------------------------
// DELETE /api/menu-files/[id]
//   論理削除（ファイル本体は消さないので、あとから復元できる）
// ------------------------------------------------------------
export async function DELETE(_req: Request, { params }: Ctx) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const { id } = await params;
  if (!id) return fail('ID が正しくありません。');

  const { error } = await supabase.from('menu_files').update({ is_deleted: true }).eq('id', id);
  if (error) return fail(toMessage(error), 400);
  return ok({ id, is_deleted: true });
}

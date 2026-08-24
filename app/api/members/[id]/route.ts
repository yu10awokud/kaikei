import { ok, fail, requireClient, readJson, isHexColor, cleanText, toMessage } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const TABLE = 'members';
const LABEL = '部員';

type Ctx = { params: Promise<{ id: string }> };

// ------------------------------------------------------------
// PATCH /api/members/[id]   名前・色・並び順・有効フラグの変更
//   ※ 部員 は削除しません（過去の履歴と集計を壊さないため）
// ------------------------------------------------------------
export async function PATCH(req: Request, { params }: Ctx) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const { id } = await params;
  if (!id) return fail('ID が正しくありません。');

  const body = await readJson(req);
  const patch: Record<string, unknown> = {};

  if ('name' in body) {
    const name = cleanText(body.name, 50);
    if (!name) return fail(LABEL + 'の名前を入力してください。');
    patch.name = name;
  }
  if ('color' in body) {
    if (!isHexColor(body.color)) return fail('色は #RRGGBB の形式で指定してください。');
    patch.color = body.color;
  }
  if ('is_active' in body) patch.is_active = Boolean(body.is_active);
  if ('sort_order' in body) {
    const n = Number(body.sort_order);
    if (!Number.isInteger(n)) return fail('並び順は整数で指定してください。');
    patch.sort_order = n;
  }

  if (Object.keys(patch).length === 0) return fail('変更する項目がありません。');

  const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select('*').single();
  if (error) return fail(toMessage(error), 400);
  return ok({ item: data });
}

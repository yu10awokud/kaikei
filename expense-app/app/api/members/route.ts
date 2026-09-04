import { ok, fail, requireClient, toMessage } from '@/lib/api-helpers';
import type { Member } from '@/lib/types';

export const dynamic = 'force-dynamic';

// ------------------------------------------------------------
// GET /api/members
//   立て替えた人を選ぶプルダウンのために、既存の部員マスタを読む。
//   引退した部員（is_active = false）も過去の立替に出てくるので含める。
// ------------------------------------------------------------
export async function GET() {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const { data, error } = await supabase
    .from('members')
    .select('id, name, is_active')
    .order('sort_order')
    .order('created_at');

  if (error) return fail(toMessage(error), 502);

  const members: Member[] = ((data ?? []) as { id: string; name: string }[]).map((m) => ({
    id: m.id,
    name: m.name,
  }));

  return ok({ members });
}

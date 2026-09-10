import { ok, fail, requireClient, toMessage } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

// ------------------------------------------------------------
// POST /api/payers/import
//   既存サイトの部員名を「写して」立替者マスタに足す（一度きりの取り込み）。
//   名前を1人ずつ打ち直す手間を省くためだけのもので、
//   取り込んだあとは完全に別物。こちらを直しても既存サイトには
//   反映されず、既存サイトを直してもこちらには反映されない。
//   すでに同じ名前が居る人は飛ばす。
// ------------------------------------------------------------
export async function POST() {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const [membersRes, payersRes] = await Promise.all([
    supabase.from('members').select('name, is_active, sort_order').order('sort_order'),
    supabase.from('payers').select('name'),
  ]);

  if (membersRes.error) return fail(toMessage(membersRes.error), 502);
  if (payersRes.error) return fail(toMessage(payersRes.error), 502);

  const existing = new Set((payersRes.data ?? []).map((p) => p.name as string));
  const rows = (membersRes.data ?? [])
    .map((m) => m as { name: string; is_active: boolean; sort_order: number })
    .filter((m) => !existing.has(m.name));

  if (rows.length === 0) return ok({ added: 0 });

  const { error } = await supabase.from('payers').insert(rows);
  if (error) return fail(toMessage(error), 400);

  return ok({ added: rows.length });
}

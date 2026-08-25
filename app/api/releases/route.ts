import { ok, fail, requireClient, readJson, isDateKey, cleanText, toMessage } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const SELECT = 'id, version, released_on, category, notes, author, is_deleted, created_at, updated_at';

// ------------------------------------------------------------
// GET /api/releases   更新履歴の一覧（新しい順）
// ------------------------------------------------------------
export async function GET() {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const { data, error } = await supabase
    .from('releases')
    .select(SELECT)
    .eq('is_deleted', false)
    .order('released_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return fail(toMessage(error), 500);
  return ok({ releases: data ?? [] });
}

// ------------------------------------------------------------
// POST /api/releases   追加
// ------------------------------------------------------------
export async function POST(req: Request) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const body = await readJson(req);

  const version = cleanText(body.version, 40);
  if (!version) return fail('バージョン名を入力してください。');

  const released_on = body.released_on;
  if (!isDateKey(released_on)) return fail('日付の形式が正しくありません（YYYY-MM-DD）。');

  const category = body.category === 'fix' ? 'fix' : 'major';
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 2000) : '';
  const author = cleanText(body.author, 40) ?? '';

  const { data, error } = await supabase
    .from('releases')
    .insert({ version, released_on, category, notes, author })
    .select(SELECT)
    .single();

  if (error) return fail(toMessage(error), 400);
  return ok({ release: data });
}

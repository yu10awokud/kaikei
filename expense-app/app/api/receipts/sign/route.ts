import { ok, fail, requireClient, readJson, toMessage } from '@/lib/api-helpers';
import { RECEIPT_BUCKET } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/** 一時URLの有効期限（秒）。画面を開いている間だけ見られれば十分。 */
const EXPIRES_IN = 60 * 30;

// ------------------------------------------------------------
// POST /api/receipts/sign   { paths: string[] }
//   非公開バケットにある領収書を表示するための、
//   有効期限つきの一時URLをまとめて発行する。
// ------------------------------------------------------------
export async function POST(req: Request) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const body = await readJson(req);
  const raw = body.paths;
  if (!Array.isArray(raw)) return fail('paths を配列で指定してください。');

  // 一度に処理する枚数に上限を設けておく
  const paths = raw.filter((p): p is string => typeof p === 'string' && p !== '').slice(0, 200);
  if (paths.length === 0) return ok({ urls: {} });

  const { data, error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrls(paths, EXPIRES_IN);

  if (error) return fail(toMessage(error), 502);

  const urls: Record<string, string> = {};
  for (const item of data ?? []) {
    // path が取れないものや、発行に失敗したものは黙って飛ばす
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }

  return ok({ urls });
}

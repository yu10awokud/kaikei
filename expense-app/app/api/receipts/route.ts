import { ok, fail, requireClient, toMessage } from '@/lib/api-helpers';
import { RECEIPT_BUCKET } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/** 受け取る画像の上限（バイト）。ブラウザ側で縮小済みなので通常は数百KB。 */
const MAX_BYTES = 6 * 1024 * 1024;

// ------------------------------------------------------------
// POST /api/receipts
//   領収書の画像を1枚アップロードして、保存先のパスを返す。
//   バケットは非公開なので、ここでは URL を返さない。
//   （表示するときに /api/receipts/sign で一時URLを発行する）
// ------------------------------------------------------------
export async function POST(req: Request) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail('画像を読み取れませんでした。もう一度お試しください。');
  }

  const file = form.get('file');
  if (!(file instanceof File)) return fail('画像が添付されていません。');
  if (file.size === 0) return fail('画像が空でした。もう一度撮影または選択してください。');
  if (file.size > MAX_BYTES) {
    return fail('画像が大きすぎます。もう一度撮影しなおしてください。');
  }
  // ブラウザ側で必ず JPEG に変換してから送っている
  if (file.type !== 'image/jpeg') {
    return fail('画像の形式が正しくありません（JPEGのみ）。');
  }

  // 保存先は 年/月/ランダムなID.jpg。元のファイル名は使わない
  // （日本語や記号が入るとパスとして扱いにくいため）
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = `${now.getUTCMonth() + 1}`.padStart(2, '0');
  const path = `${year}/${month}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: 'image/jpeg', upsert: false });

  if (error) return fail(toMessage(error), 502);

  return ok({ path });
}

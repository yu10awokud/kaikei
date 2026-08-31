import { ok, fail, requireClient, isDateKey, cleanText, toMessage } from '@/lib/api-helpers';
import { menuFileUrl } from '@/lib/queries';

export const dynamic = 'force-dynamic';

const SELECT = 'id, date, file_name, storage_path, size_bytes, note, is_deleted, created_at, updated_at';

/** 受け付ける最大サイズ（10MB） */
const MAX_BYTES = 10 * 1024 * 1024;

// ------------------------------------------------------------
// GET /api/menu-files
//   ?date=YYYY-MM-DD  その日のぶんだけ
//   ?deleted=1        削除済みだけ（管理画面用）
// ------------------------------------------------------------
export async function GET(req: Request) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  const deleted = url.searchParams.get('deleted') === '1';

  let query = supabase
    .from('menu_files')
    .select(SELECT)
    .eq('is_deleted', deleted)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (date && isDateKey(date)) query = query.eq('date', date);

  const { data, error } = await query;
  if (error) return fail(toMessage(error), 500);

  const files = (data ?? []).map((f) => ({
    ...f,
    url: menuFileUrl(f.storage_path as string),
  }));
  return ok({ files });
}

// ------------------------------------------------------------
// POST /api/menu-files
//   PDF を受け取ってストレージに保存し、情報を記録する
//   （フォームデータで file と date を送る）
// ------------------------------------------------------------
export async function POST(req: Request) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail('ファイルを受け取れませんでした。');
  }

  const date = form.get('date');
  const file = form.get('file');
  const note = cleanText(form.get('note'));

  if (typeof date !== 'string' || !isDateKey(date)) {
    return fail('日付の形式が正しくありません（YYYY-MM-DD）。');
  }
  if (!(file instanceof File)) return fail('PDFファイルを選んでください。');

  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return fail('PDFファイルだけアップロードできます。');

  if (file.size === 0) return fail('ファイルの中身が空です。');
  if (file.size > MAX_BYTES) {
    return fail(`ファイルが大きすぎます（${Math.round(MAX_BYTES / 1024 / 1024)}MBまで）。`);
  }

  // 保存先：日付フォルダ＋ランダムな名前（URL を推測されないように）
  const storagePath = `${date}/${crypto.randomUUID()}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('menus')
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    const message = uploadError.message ?? '';
    if (message.includes('Bucket not found')) {
      return fail(
        'ファイルの保存先が見つかりません。supabase/migration-menu-files.sql を実行してください。',
        500
      );
    }
    return fail(`アップロードに失敗しました：${message}`, 500);
  }

  const { data, error } = await supabase
    .from('menu_files')
    .insert({
      date,
      file_name: file.name.slice(0, 120),
      storage_path: storagePath,
      size_bytes: file.size,
      note,
    })
    .select(SELECT)
    .single();

  if (error) {
    // 記録に失敗したらアップロード済みファイルを消しておく
    await supabase.storage.from('menus').remove([storagePath]);
    return fail(toMessage(error), 400);
  }

  return ok({ file: { ...data, url: menuFileUrl(storagePath) } });
}

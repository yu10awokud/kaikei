import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import { dbError, emptyToNull, guardEdit, readJson } from "@/lib/api-helpers";
import { validateEventInput } from "@/lib/validators";

/**
 * /api/events/[id]
 *   PATCH  … 1件更新（要 編集モード）
 *   DELETE … 1件削除（要 編集モード）
 *
 * [id] というフォルダ名は「URL のこの部分は変数」という意味です。
 * /api/events/abc-123 なら params.id === 'abc-123' になります。
 *
 * ※ Next.js 15 から params は Promise になりました。await が必要です。
 *   （14 までは await 不要でした。ネットの古い記事と違う点なので注意）
 */

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = guardEdit(req);
  if (denied) return denied;

  const { id } = await params;
  const body = await readJson<Record<string, string>>(req);
  if (!body) return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });

  const invalid = validateEventInput(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .update({
      date: body.date,
      type: body.type,
      title: body.title.trim(),
      start_time: emptyToNull(body.start_time),
      end_time: emptyToNull(body.end_time),
      place: emptyToNull(body.place),
      memo: emptyToNull(body.memo),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return dbError("予定の更新に失敗しました", error);
  return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = guardEdit(req);
  if (denied) return denied;

  const { id } = await params;
  const supabase = createSupabaseClient();
  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) return dbError("予定の削除に失敗しました", error);
  return NextResponse.json({ ok: true });
}

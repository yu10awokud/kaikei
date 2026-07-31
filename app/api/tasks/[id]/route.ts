import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import { dbError, emptyToNull, guardEdit, readJson } from "@/lib/api-helpers";
import { validateTaskInput } from "@/lib/validators";

/**
 * /api/tasks/[id]
 *   PATCH  … 更新（要 編集モード）
 *   DELETE … 削除（要 編集モード）
 *
 * PATCH は2通りの使い方をします。
 *   1) { done: true } だけ送る       → 完了チェックの ON/OFF
 *   2) title などを送る              → フォームからの編集
 * 送られてきた項目だけを更新するようにしているので、
 * チェックを付けるだけのときにタイトルが消えたりしません。
 */

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = guardEdit(req);
  if (denied) return denied;

  const { id } = await params;
  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });

  const patch: Record<string, unknown> = {};

  // 「done だけを切り替える」リクエストか判定する
  const isToggleOnly = Object.keys(body).length === 1 && "done" in body;

  if ("done" in body) patch.done = Boolean(body.done);

  if (!isToggleOnly) {
    const invalid = validateTaskInput(body as Record<string, string>);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    patch.title = String(body.title).trim();
    patch.priority = body.priority;
    patch.due_date = emptyToNull(body.due_date);
    patch.memo = emptyToNull(body.memo);
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return dbError("タスクの更新に失敗しました", error);
  return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = guardEdit(req);
  if (denied) return denied;

  const { id } = await params;
  const supabase = createSupabaseClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) return dbError("タスクの削除に失敗しました", error);
  return NextResponse.json({ ok: true });
}

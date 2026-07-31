import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import { dbError, emptyToNull, guardEdit, readJson } from "@/lib/api-helpers";
import { validateTaskInput } from "@/lib/validators";

/**
 * /api/tasks
 *   GET  … 全タスク取得（誰でも可）
 *   POST … 追加（要 編集モード）
 */

export async function GET() {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return dbError("タスクの取得に失敗しました", error);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const denied = guardEdit(req);
  if (denied) return denied;

  const body = await readJson<Record<string, string>>(req);
  if (!body) return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });

  const invalid = validateTaskInput(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: body.title.trim(),
      priority: body.priority,
      due_date: emptyToNull(body.due_date),
      memo: emptyToNull(body.memo),
      done: false,
    })
    .select()
    .single();

  if (error) return dbError("タスクの追加に失敗しました", error);
  return NextResponse.json(data, { status: 201 });
}

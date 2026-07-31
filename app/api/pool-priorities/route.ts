import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import { dbError, emptyToNull, guardEdit, readJson } from "@/lib/api-helpers";
import { validatePriorityInput } from "@/lib/validators";

/** /api/pool-priorities  GET=一覧 / POST=追加（要 編集モード） */

export async function GET() {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("pool_priorities")
    .select("*")
    .order("weekday")
    .order("start_month")
    .order("rank");

  if (error) return dbError("優先順位の取得に失敗しました", error);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const denied = guardEdit(req);
  if (denied) return denied;

  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });

  const invalid = validatePriorityInput(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("pool_priorities")
    .insert({
      pool_id: body.pool_id,
      weekday: Number(body.weekday),
      start_month: Number(body.start_month),
      end_month: Number(body.end_month),
      rank: Number(body.rank),
      unlikely: Boolean(body.unlikely),
      note: emptyToNull(body.note),
    })
    .select()
    .single();

  if (error) return dbError("優先順位の追加に失敗しました", error);
  return NextResponse.json(data, { status: 201 });
}

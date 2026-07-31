import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import { dbError, emptyToNull, guardEdit, readJson } from "@/lib/api-helpers";
import { validatePriorityInput } from "@/lib/validators";

/** /api/pool-priorities/[id]  PATCH=更新 / DELETE=削除（要 編集モード） */

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = guardEdit(req);
  if (denied) return denied;

  const { id } = await params;
  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });

  const invalid = validatePriorityInput(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("pool_priorities")
    .update({
      pool_id: body.pool_id,
      weekday: Number(body.weekday),
      start_month: Number(body.start_month),
      end_month: Number(body.end_month),
      rank: Number(body.rank),
      unlikely: Boolean(body.unlikely),
      note: emptyToNull(body.note),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return dbError("優先順位の更新に失敗しました", error);
  return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = guardEdit(req);
  if (denied) return denied;

  const { id } = await params;
  const supabase = createSupabaseClient();
  const { error } = await supabase.from("pool_priorities").delete().eq("id", id);

  if (error) return dbError("優先順位の削除に失敗しました", error);
  return NextResponse.json({ ok: true });
}

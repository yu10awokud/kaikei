import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import { dbError, emptyToNull, guardEdit, readJson } from "@/lib/api-helpers";
import { validatePoolInput } from "@/lib/validators";

/** /api/pools/[id]  PATCH=更新 / DELETE=削除（どちらも要 編集モード） */

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = guardEdit(req);
  if (denied) return denied;

  const { id } = await params;
  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });

  const invalid = validatePoolInput(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("pools")
    .update({
      name: String(body.name).trim(),
      method: body.method,
      contact: emptyToNull(body.contact),
      staff_name: emptyToNull(body.staff_name),
      rule_type: body.rule_type,
      rule_value:
        body.rule_type === "unknown" || body.rule_value === "" || body.rule_value == null
          ? null
          : Number(body.rule_value),
      lead_days:
        body.lead_days == null || body.lead_days === "" ? 7 : Number(body.lead_days),
      manual: emptyToNull(body.manual),
      active: body.active === undefined ? true : Boolean(body.active),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return dbError("プールの更新に失敗しました", error);
  return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = guardEdit(req);
  if (denied) return denied;

  const { id } = await params;
  const supabase = createSupabaseClient();

  // pool_priorities と routine_logs は on delete cascade を付けてあるので、
  // プールを消せば紐づくデータも一緒に消えます（DDL 側で担保）。
  const { error } = await supabase.from("pools").delete().eq("id", id);

  if (error) return dbError("プールの削除に失敗しました", error);
  return NextResponse.json({ ok: true });
}

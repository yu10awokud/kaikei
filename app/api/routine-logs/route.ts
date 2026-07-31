import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import { dbError, emptyToNull, guardEdit, readJson } from "@/lib/api-helpers";
import { isMonthString, isNonEmpty } from "@/lib/validators";

/**
 * /api/routine-logs
 *   GET  ?months=2026-07,2026-08 … 指定した利用月の記録を取得
 *   POST                          … 「予約できた/取れなかった/見送り」を記録（要 編集モード）
 */

const RESULTS = ["booked", "failed", "skipped"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const months = searchParams.get("months");

  const supabase = createSupabaseClient();
  let query = supabase.from("routine_logs").select("*");
  if (months) query = query.in("target_month", months.split(","));

  const { data, error } = await query;
  if (error) return dbError("記録の取得に失敗しました", error);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const denied = guardEdit(req);
  if (denied) return denied;

  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });

  if (!isNonEmpty(body.pool_id)) {
    return NextResponse.json({ error: "プールが指定されていません" }, { status: 400 });
  }
  if (!isMonthString(body.target_month)) {
    return NextResponse.json({ error: "利用月が不正です" }, { status: 400 });
  }
  const weekday = Number(body.weekday);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return NextResponse.json({ error: "曜日が不正です" }, { status: 400 });
  }
  if (typeof body.result !== "string" || !RESULTS.includes(body.result)) {
    return NextResponse.json({ error: "結果の種別が不正です" }, { status: 400 });
  }

  const supabase = createSupabaseClient();

  /**
   * upsert は「無ければ INSERT、あれば UPDATE」。
   * onConflict に DDL のユニーク制約と同じ列の組み合わせを指定することで、
   * 「同じプール・同じ利用月・同じ曜日」の記録が二重にならないようにしています。
   * （例: 間違えて「取れなかった」を押したあと「予約できた」を押し直せる）
   */
  const { data, error } = await supabase
    .from("routine_logs")
    .upsert(
      {
        pool_id: body.pool_id,
        target_month: body.target_month,
        weekday,
        result: body.result,
        note: emptyToNull(body.note),
        done_at: new Date().toISOString(),
      },
      { onConflict: "pool_id,target_month,weekday" },
    )
    .select()
    .single();

  if (error) return dbError("記録の保存に失敗しました", error);
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: Request) {
  const denied = guardEdit(req);
  if (denied) return denied;

  // 記録の取り消し（要対応リストに戻す）用
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id が必要です" }, { status: 400 });

  const supabase = createSupabaseClient();
  const { error } = await supabase.from("routine_logs").delete().eq("id", id);
  if (error) return dbError("記録の取り消しに失敗しました", error);
  return NextResponse.json({ ok: true });
}

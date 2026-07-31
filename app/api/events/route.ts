import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import { dbError, emptyToNull, guardEdit, readJson } from "@/lib/api-helpers";
import { validateEventInput } from "@/lib/validators";

/**
 * /api/events
 *   GET  ?from=YYYY-MM-DD&to=YYYY-MM-DD  … 期間内の予定を取得（誰でも可）
 *   POST                                  … 予定を1件追加（要 編集モード）
 *
 * route.ts で export してよいのは GET / POST / PUT / PATCH / DELETE などの
 * 決まった名前だけです。共通処理は lib/ に置きます。
 */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const supabase = createSupabaseClient();
  let query = supabase.from("events").select("*").order("date").order("start_time");

  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

  const { data, error } = await query;
  if (error) return dbError("予定の取得に失敗しました", error);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  // 編集モードの検証を最初に行う。これを忘れると誰でも書き込めてしまいます。
  const denied = guardEdit(req);
  if (denied) return denied;

  const body = await readJson<Record<string, string>>(req);
  if (!body) return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });

  const invalid = validateEventInput(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      date: body.date,
      type: body.type,
      title: body.title.trim(),
      start_time: emptyToNull(body.start_time),
      end_time: emptyToNull(body.end_time),
      place: emptyToNull(body.place),
      memo: emptyToNull(body.memo),
    })
    .select()
    .single();

  if (error) return dbError("予定の追加に失敗しました", error);
  return NextResponse.json(data, { status: 201 });
}

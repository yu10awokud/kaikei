import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import { dbError, emptyToNull, guardEdit, readJson } from "@/lib/api-helpers";
import { isEventType, isNonEmpty } from "@/lib/validators";
import { datesOfWeekdayInMonth, toDateString } from "@/lib/date-utils";

/**
 * /api/events/bulk  … 曜日まとめ登録（要 編集モード）
 *
 * 「2026年9月の火曜と木曜、全部を練習にする」といった一括作成を行います。
 *
 * 対象日の計算 (datesOfWeekdayInMonth) は画面側のプレビューでも使う共通関数です。
 * 同じ関数を使うことで「プレビューと実際の作成結果がズレる」事故を防いでいます。
 */

type BulkInput = {
  year: number;
  month: number; // 1-12
  weekdays: number[]; // 0=日 〜 6=土
  type: string;
  title: string;
  start_time?: string;
  end_time?: string;
  place?: string;
  memo?: string;
  /** 既に予定がある日を上書きするか。false ならその日はスキップ */
  overwrite: boolean;
};

export async function POST(req: Request) {
  const denied = guardEdit(req);
  if (denied) return denied;

  const body = await readJson<BulkInput>(req);
  if (!body) return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });

  const { year, month, weekdays, type, title, overwrite } = body;

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "年が不正です" }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "月が不正です" }, { status: 400 });
  }
  if (!Array.isArray(weekdays) || weekdays.length === 0) {
    return NextResponse.json({ error: "曜日を1つ以上選んでください" }, { status: 400 });
  }
  if (!isEventType(type)) {
    return NextResponse.json({ error: "種別が不正です" }, { status: 400 });
  }
  if (!isNonEmpty(title)) {
    return NextResponse.json({ error: "タイトルを入力してください" }, { status: 400 });
  }

  // 対象日を計算して昇順に並べる
  const targetDates = weekdays
    .filter((w) => Number.isInteger(w) && w >= 0 && w <= 6)
    .flatMap((w) => datesOfWeekdayInMonth(year, month, w))
    .map(toDateString)
    .sort();

  if (targetDates.length === 0) {
    return NextResponse.json({ error: "対象日がありません" }, { status: 400 });
  }

  const supabase = createSupabaseClient();

  // 既に予定がある日を調べる
  const { data: existing, error: selectError } = await supabase
    .from("events")
    .select("id, date")
    .in("date", targetDates);

  if (selectError) return dbError("既存予定の確認に失敗しました", selectError);

  const occupied = new Set((existing ?? []).map((e) => e.date as string));

  let deleted = 0;
  let createDates: string[];
  let skipped: string[] = [];

  if (overwrite) {
    // 上書き: 対象日の既存予定を消してから作り直す
    const ids = (existing ?? []).map((e) => e.id as string);
    if (ids.length > 0) {
      const { error: deleteError } = await supabase
        .from("events")
        .delete()
        .in("id", ids);
      if (deleteError) return dbError("既存予定の削除に失敗しました", deleteError);
      deleted = ids.length;
    }
    createDates = targetDates;
  } else {
    // スキップ: 予定が入っている日は触らない
    createDates = targetDates.filter((d) => !occupied.has(d));
    skipped = targetDates.filter((d) => occupied.has(d));
  }

  if (createDates.length > 0) {
    const rows = createDates.map((date) => ({
      date,
      type,
      title: title.trim(),
      start_time: emptyToNull(body.start_time),
      end_time: emptyToNull(body.end_time),
      place: emptyToNull(body.place),
      memo: emptyToNull(body.memo),
    }));
    const { error: insertError } = await supabase.from("events").insert(rows);
    if (insertError) return dbError("予定の一括作成に失敗しました", insertError);
  }

  return NextResponse.json({
    created: createDates,
    skipped,
    deleted,
  });
}

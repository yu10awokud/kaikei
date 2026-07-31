import { createSupabaseClient } from "@/lib/supabase";
import { buildCalendarGrid, toDateString } from "@/lib/date-utils";
import { CalendarBoard } from "@/components/calendar/CalendarBoard";
import { SetupNotice } from "@/components/SetupNotice";
import type { EventRow } from "@/lib/types";

/**
 * カレンダー管理ページ（Server Component）
 *
 * 【Server Component とは】
 *  'use client' が付いていないファイルは、サーバーだけで実行されます。
 *  - DB アクセスのコードがブラウザに送られない（安全・軽い）
 *  - async/await をコンポーネントに直接書ける（下の await がそれ）
 *  - useState や onClick は使えない
 *
 *  なので「DBから読む」のはここ（Server）、
 *  「クリックしたら開くモーダル」は CalendarBoard（Client）、と役割を分けています。
 *
 * 【force-dynamic】
 *  Next.js は既定でページを事前生成してキャッシュしようとします。
 *  予定は頻繁に変わるので「毎回アクセス時に最新を取りに行く」と宣言しています。
 */
export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  // Next.js 15 では searchParams も Promise なので await が必要です
  searchParams: Promise<{ ym?: string }>;
}) {
  const { ym } = await searchParams;

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  // URL の ?ym=2026-09 で表示月を切り替える。
  // 「表示中の月」を state ではなく URL に持たせると、
  // ブラウザの戻る/進むが効き、リンクの共有もできて便利です。
  if (ym && /^\d{4}-\d{2}$/.test(ym)) {
    const [y, m] = ym.split("-").map(Number);
    if (m >= 1 && m <= 12) {
      year = y;
      month = m;
    }
  }

  // カレンダーは前月末・翌月頭のマスも表示するので、42日分をまとめて取得します
  const grid = buildCalendarGrid(year, month);
  const from = toDateString(grid[0]);
  const to = toDateString(grid[grid.length - 1]);

  let events: EventRow[] = [];
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .gte("date", from)
      .lte("date", to)
      .order("date")
      .order("start_time", { nullsFirst: true });
    if (error) throw new Error(error.message);
    events = (data ?? []) as EventRow[];
  } catch (e) {
    return <SetupNotice error={e} />;
  }

  return <CalendarBoard year={year} month={month} events={events} />;
}

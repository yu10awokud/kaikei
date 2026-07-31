import { createSupabaseClient } from "@/lib/supabase";
import { SetupNotice } from "@/components/SetupNotice";
import { TopDashboard } from "@/components/top/TopDashboard";
import {
  buildCalendarGrid,
  toDateString,
  today,
  upcomingTargetMonths,
} from "@/lib/date-utils";
import type {
  EventRow,
  PoolPriorityRow,
  PoolRow,
  RoutineLogRow,
  TaskRow,
} from "@/lib/types";

/**
 * TOP画面（Server Component）
 *
 * ここでは「DBから必要な材料を全部取ってくる」ことだけをします。
 * 自動タスクの計算は TopDashboard（Client Component）側で行います。
 *
 * 【なぜ計算をクライアント側でやるのか】
 *  - 「予約できた/取れなかった」を押した直後の見た目の変化（次の候補を強調など）に
 *    useState が必要で、それは Client Component にしか書けないため
 *  - 計算に使う材料（pools / priorities / logs）はただの配列なので、
 *    サーバーからそのまま渡せる
 *  - Date 型のような「そのままでは受け渡しに気を使うもの」を props に含めずに済む
 */
export const dynamic = "force-dynamic";

export default async function TopPage() {
  const now = today();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // 今月のカレンダー概観に必要な期間（前後の月のマスも含む42日ぶん）
  const grid = buildCalendarGrid(year, month);
  const gridFrom = toDateString(grid[0]);
  const gridTo = toDateString(grid[grid.length - 1]);
  const todayStr = toDateString(now);
  const targetMonths = upcomingTargetMonths(now, 3);

  let events: EventRow[] = [];
  let nextEvent: EventRow | null = null;
  let tasks: TaskRow[] = [];
  let pools: PoolRow[] = [];
  let priorities: PoolPriorityRow[] = [];
  let logs: RoutineLogRow[] = [];

  try {
    const supabase = createSupabaseClient();

    const [eventsRes, nextEventRes, tasksRes, poolsRes, prioRes, logsRes] =
      await Promise.all([
        supabase.from("events").select("*").gte("date", gridFrom).lte("date", gridTo),
        // 「次のイベント」= type='event' で今日以降のいちばん近いもの1件
        supabase
          .from("events")
          .select("*")
          .eq("type", "event")
          .gte("date", todayStr)
          .order("date")
          .limit(1),
        supabase.from("tasks").select("*").eq("done", false),
        supabase.from("pools").select("*").order("name"),
        supabase.from("pool_priorities").select("*"),
        // 対象3か月ぶんの記録だけ取れば十分（全部取ると年々重くなる）
        supabase.from("routine_logs").select("*").in("target_month", targetMonths),
      ]);

    for (const r of [eventsRes, nextEventRes, tasksRes, poolsRes, prioRes, logsRes]) {
      if (r.error) throw new Error(r.error.message);
    }

    events = (eventsRes.data ?? []) as EventRow[];
    nextEvent = ((nextEventRes.data ?? [])[0] ?? null) as EventRow | null;
    tasks = (tasksRes.data ?? []) as TaskRow[];
    pools = (poolsRes.data ?? []) as PoolRow[];
    priorities = (prioRes.data ?? []) as PoolPriorityRow[];
    logs = (logsRes.data ?? []) as RoutineLogRow[];
  } catch (e) {
    return <SetupNotice error={e} />;
  }

  return (
    <TopDashboard
      year={year}
      month={month}
      events={events}
      nextEvent={nextEvent}
      tasks={tasks}
      pools={pools}
      priorities={priorities}
      logs={logs}
    />
  );
}

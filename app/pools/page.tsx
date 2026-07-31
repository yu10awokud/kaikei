import { createSupabaseClient } from "@/lib/supabase";
import { SetupNotice } from "@/components/SetupNotice";
import { PoolManager } from "@/components/pools/PoolManager";
import type { PoolPriorityRow, PoolRow } from "@/lib/types";

/**
 * プールマスタ（Server Component）
 * pools と pool_priorities を2回に分けて取得し、まとめて Client に渡します。
 */
export const dynamic = "force-dynamic";

export default async function PoolsPage() {
  let pools: PoolRow[] = [];
  let priorities: PoolPriorityRow[] = [];

  try {
    const supabase = createSupabaseClient();

    // Promise.all で2つのクエリを同時に投げる（順番に待つより速い）
    const [poolRes, prioRes] = await Promise.all([
      supabase.from("pools").select("*").order("name"),
      supabase
        .from("pool_priorities")
        .select("*")
        .order("weekday")
        .order("start_month")
        .order("rank"),
    ]);

    if (poolRes.error) throw new Error(poolRes.error.message);
    if (prioRes.error) throw new Error(prioRes.error.message);

    pools = (poolRes.data ?? []) as PoolRow[];
    priorities = (prioRes.data ?? []) as PoolPriorityRow[];
  } catch (e) {
    return <SetupNotice error={e} />;
  }

  return <PoolManager pools={pools} priorities={priorities} />;
}

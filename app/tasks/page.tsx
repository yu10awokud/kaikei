import { createSupabaseClient } from "@/lib/supabase";
import { SetupNotice } from "@/components/SetupNotice";
import { TaskManager } from "@/components/tasks/TaskManager";
import type { TaskRow } from "@/lib/types";

/**
 * タスク管理ページ（Server Component）
 * DB から読むところまでがサーバーの仕事。表示と操作は TaskManager（Client）に渡します。
 */
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  let tasks: TaskRow[] = [];
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    tasks = (data ?? []) as TaskRow[];
  } catch (e) {
    return <SetupNotice error={e} />;
  }

  return <TaskManager tasks={tasks} />;
}

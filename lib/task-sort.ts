import type { Priority, TaskRow } from "./types";

/** 優先度の並び順（数字が小さいほど先に出す） */
export const PRIORITY_ORDER: Record<Priority, number> = { high: 0, mid: 1, low: 2 };

/**
 * タスクの並び替え規則。
 *   1. 期日が近い順
 *   2. 期日なしは最後
 *   3. 期日が同じなら優先度の高い順
 *
 * TOP画面の要対応リストでも同じ考え方を使いたいので、関数として切り出しています。
 */
export function compareTasks(a: TaskRow, b: TaskRow): number {
  if (a.due_date && b.due_date) {
    if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  } else if (a.due_date) {
    return -1; // 期日ありが先
  } else if (b.due_date) {
    return 1;
  }
  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
}

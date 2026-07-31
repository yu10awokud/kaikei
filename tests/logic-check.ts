/**
 * 中核ロジックの検証スクリプト
 *
 *   npm run check:logic
 *
 * Supabase なしで、年またぎ判定・受付開始日の計算・自動タスク生成が
 * 正しく動くかを確認します。ルールを変更したら、まずここを走らせてください。
 * assert が1つでも失敗すると、その場でエラーになります。
 */
import assert from "node:assert";
import { isMonthInRange, calcOpenDate, toDateString } from "../lib/date-utils";
import { buildAutoTaskGroups } from "../lib/auto-tasks";
import type { PoolRow, PoolPriorityRow, RoutineLogRow } from "../lib/types";

// --- 年またぎ判定 ---
assert.equal(isMonthInRange(6, 5, 8), true);
assert.equal(isMonthInRange(9, 5, 8), false);
for (const m of [9, 10, 11, 12, 1, 2, 3, 4]) assert.equal(isMonthInRange(m, 9, 4), true, `9-4 should include ${m}`);
for (const m of [5, 6, 7, 8]) assert.equal(isMonthInRange(m, 9, 4), false, `9-4 should exclude ${m}`);
for (const m of [10, 11, 12, 1, 2, 3]) assert.equal(isMonthInRange(m, 10, 3), true);
for (const m of [4, 5, 6, 7, 8, 9]) assert.equal(isMonthInRange(m, 10, 3), false);
console.log("OK: isMonthInRange (wraparound)");

// --- 受付開始日 ---
assert.equal(toDateString(calcOpenDate("months_before", 3, "2026-09")!), "2026-06-01");
assert.equal(toDateString(calcOpenDate("months_before", 1, "2026-01")!), "2025-12-01");
assert.equal(toDateString(calcOpenDate("fixed_day", 15, "2026-11")!), "2026-10-15");
assert.equal(toDateString(calcOpenDate("fixed_day", 31, "2026-03")!), "2026-02-28"); // 月末に丸める
assert.equal(calcOpenDate("unknown", null, "2026-09"), null);
console.log("OK: calcOpenDate");

// --- 自動タスク生成 ---
const pools: PoolRow[] = [
  { id: "p1", name: "イリアス", method: "email", contact: null, staff_name: null, rule_type: "months_before", rule_value: 3, lead_days: 7, manual: null, active: true },
  { id: "p2", name: "踏水会", method: "counter", contact: null, staff_name: null, rule_type: "fixed_day", rule_value: 10, lead_days: 5, manual: null, active: true },
  { id: "p3", name: "ピノス", method: "phone", contact: null, staff_name: null, rule_type: "fixed_day", rule_value: 10, lead_days: 5, manual: null, active: true },
  { id: "p4", name: "休止中プール", method: "web", contact: null, staff_name: null, rule_type: "months_before", rule_value: 3, lead_days: 90, manual: null, active: false },
];
const priorities: PoolPriorityRow[] = [
  { id: "x1", pool_id: "p1", weekday: 2, start_month: 1, end_month: 12, rank: 1, unlikely: false, note: "取れなければオフ" },
  { id: "x2", pool_id: "p3", weekday: 6, start_month: 10, end_month: 3, rank: 0, unlikely: true, note: "冬期は基本取れない" },
  { id: "x3", pool_id: "p2", weekday: 6, start_month: 10, end_month: 3, rank: 1, unlikely: false, note: null },
  { id: "x4", pool_id: "p4", weekday: 6, start_month: 1, end_month: 12, rank: 9, unlikely: false, note: null },
];

// 基準日 2026-11-20 → 対象は 2026-11 / 2026-12 / 2027-01
const base = new Date(2026, 10, 20);
let groups = buildAutoTaskGroups({ pools, priorities, logs: [], base });
console.log("groups:", groups.map((g) => `${g.heading} [${g.items.map((i) => `${i.rank}:${i.poolName}`).join(", ")}] open=${g.sortDate && toDateString(g.sortDate)}`));

// active=false のプールは出ない
assert.ok(groups.every((g) => g.items.every((i) => i.poolName !== "休止中プール")), "inactive pool must be excluded");

// 土曜枠は 10〜3月の年またぎ範囲 → 11月・12月・1月すべて該当
const satGroups = groups.filter((g) => g.weekday === 6);
assert.equal(satGroups.length, 2, "土曜は11月・12月分のみ表示時期（1月分はまだ先）");
// グループ内は rank 昇順（0 が先頭）
assert.equal(satGroups[0].items[0].rank, 0);
assert.equal(satGroups[0].items[0].poolName, "ピノス");
assert.equal(satGroups[0].items[1].poolName, "踏水会");

// 文言の自動生成
const nov = satGroups.find((g) => g.targetMonth === "2026-11")!;
assert.equal(nov.items[0].label, "ピノスの担当者に電話（11月分 土曜枠）");
assert.equal(nov.items[1].label, "踏水会の窓口で申込（11月分 土曜枠）");
const tue = groups.find((g) => g.weekday === 2 && g.targetMonth === "2027-01");
assert.ok(tue, "1月分の火曜枠が出るはず(受付開始 2026-10-01)");
assert.equal(tue!.items[0].label, "イリアスの担当者にメール（1月分 火曜枠）");
console.log("OK: label generation / grouping / rank order");

// lead_days の判定: 2027-01分の土曜枠は受付開始 2026-12-10、lead 5日 → 12/5から表示。11/20時点では出ない
const jan = satGroups.find((g) => g.targetMonth === "2027-01");
assert.equal(jan, undefined, "1月分の土曜枠はまだ表示時期ではない");
console.log("OK: lead_days gating");

// routine_logs による除外
const logs: RoutineLogRow[] = [
  { id: "l1", pool_id: "p3", target_month: "2026-11", weekday: 6, result: "failed", done_at: "", note: null },
];
groups = buildAutoTaskGroups({ pools, priorities, logs, base });
const nov2 = groups.find((g) => g.key === "2026-11__6")!;
assert.equal(nov2.items.length, 1);
assert.equal(nov2.items[0].poolName, "踏水会", "記録済みのピノスは消え、次候補が先頭になる");
console.log("OK: routine_logs exclusion");

// rule_type unknown は「調査」タスクとして常時表示
const unknownPools: PoolRow[] = [
  { id: "u1", name: "アクオン", method: "unknown", contact: null, staff_name: null, rule_type: "unknown", rule_value: null, lead_days: 7, manual: null, active: true },
];
const unknownPrio: PoolPriorityRow[] = [
  { id: "y1", pool_id: "u1", weekday: 4, start_month: 1, end_month: 12, rank: 1, unlikely: false, note: null },
];
const g2 = buildAutoTaskGroups({ pools: unknownPools, priorities: unknownPrio, logs: [], base });
assert.equal(g2.length, 3);
assert.equal(g2[0].items[0].label, "アクオンの予約方法を調査（11月分 木曜枠）");
assert.equal(g2[0].sortDate, null);
console.log("OK: unknown rule -> investigation task");

console.log("\nすべての検証に成功しました");

import { differenceInCalendarDays } from "date-fns";
import {
  calcOpenDate,
  calcVisibleFrom,
  formatMonthJa,
  isMonthInRange,
  parseMonthString,
  today,
  upcomingTargetMonths,
} from "./date-utils";
import {
  WEEKDAY_LABEL,
  type PoolPriorityRow,
  type PoolRow,
  type RoutineLogRow,
} from "./types";

/**
 * ============================================================
 * 自動タスク算出 ― このアプリの中核
 * ============================================================
 *
 * cron（定期実行）は使わず、TOP画面を開いたその瞬間に計算します。
 * だから「サーバーで毎晩バッチを回す」といった仕組みが要りません。
 *
 * 手順:
 *   1. 対象の「利用月」を 今月・翌月・翌々月 の3か月にする
 *   2. 各 pool_priorities について、その利用月が
 *      start_month〜end_month に入るか判定（年またぎ考慮 = isMonthInRange）
 *   3. pool の rule_type / rule_value から受付開始日を計算
 *   4. 今日 >= 受付開始日 - lead_days なら「要対応」
 *   5. routine_logs に記録済みのものは除外
 *   6. 予約方法に応じて表示文言を自動生成
 *   7. 同じ 曜日 × 利用月 の候補を rank 順にグループ化
 *
 * この関数は「入力が同じなら必ず同じ結果を返す」純粋な関数にしてあります。
 * DB アクセスやランダム要素を混ぜていないので、動きを追いやすく、
 * テストもしやすくなります。
 */

export type AutoTaskItem = {
  /** React の key 用の一意な文字列 */
  key: string;
  poolId: string;
  poolName: string;
  method: PoolRow["method"];
  contact: string | null;
  staffName: string | null;
  manual: string | null;
  targetMonth: string; // 'YYYY-MM'
  weekday: number;
  rank: number;
  unlikely: boolean;
  note: string | null;
  /** 受付開始日。ルール未設定なら null */
  openDate: Date | null;
  /** 受付開始日までの残り日数。null なら算出不可 */
  daysUntilOpen: number | null;
  /** rule_type が unknown で、日付が決まらない状態か */
  ruleUnknown: boolean;
  /** 表示文言（例:「イリアスの担当者にメール（9月分 火曜枠）」） */
  label: string;
};

export type AutoTaskGroup = {
  key: string; // 'YYYY-MM-weekday'
  targetMonth: string;
  weekday: number;
  /** rank の小さい順に並んだ候補 */
  items: AutoTaskItem[];
  /** 並び替え用の代表日（グループ内で一番早い受付開始日）。無ければ null */
  sortDate: Date | null;
  /** 見出し（例:「2026年9月分 火曜枠」） */
  heading: string;
};

export function buildAutoTaskGroups({
  pools,
  priorities,
  logs,
  base = today(),
  monthCount = 3,
}: {
  pools: PoolRow[];
  priorities: PoolPriorityRow[];
  logs: RoutineLogRow[];
  base?: Date;
  monthCount?: number;
}): AutoTaskGroup[] {
  const targetMonths = upcomingTargetMonths(base, monthCount);

  // プールを id で引けるようにしておく（毎回 find すると遅いため）
  const poolById = new Map(pools.map((p) => [p.id, p]));

  // 「もう手を打った」組み合わせの集合。Set にしておくと判定が一瞬で済みます。
  const doneKeys = new Set(
    logs.map((l) => `${l.pool_id}__${l.target_month}__${l.weekday}`),
  );

  const groups = new Map<string, AutoTaskGroup>();

  for (const targetMonth of targetMonths) {
    const monthNum = parseMonthString(targetMonth).getMonth() + 1;

    for (const prio of priorities) {
      const pool = poolById.get(prio.pool_id);
      if (!pool || !pool.active) continue;

      // --- 手順2: 季節の判定（年またぎ対応） ---
      if (!isMonthInRange(monthNum, prio.start_month, prio.end_month)) continue;

      // --- 手順5: 記録済みなら出さない ---
      if (doneKeys.has(`${pool.id}__${targetMonth}__${prio.weekday}`)) continue;

      // --- 手順3: 受付開始日 ---
      const openDate = calcOpenDate(pool.rule_type, pool.rule_value, targetMonth);
      const ruleUnknown = openDate === null;

      // --- 手順4: 表示タイミングの判定 ---
      // ルール未設定 (unknown) のものは日付が決まらないので、
      // 「予約方法を調査」タスクとして常に出します（調べないと永遠に出ないため）。
      //
      // 日数の比較はすべて base（既定は「今日」）を基準にします。
      // ここで today() を直接呼ぶと、base を差し替えたときに
      // 「対象月は未来なのに表示判定だけ今日基準」というちぐはぐな状態になります。
      if (!ruleUnknown) {
        const visibleFrom = calcVisibleFrom(openDate, pool.lead_days);
        if (differenceInCalendarDays(visibleFrom, base) > 0) continue; // まだ出す時期ではない
      }

      // --- 手順6: 文言の自動生成 ---
      const label = buildLabel(pool, targetMonth, prio.weekday, ruleUnknown);

      const item: AutoTaskItem = {
        key: `${pool.id}__${targetMonth}__${prio.weekday}`,
        poolId: pool.id,
        poolName: pool.name,
        method: pool.method,
        contact: pool.contact,
        staffName: pool.staff_name,
        manual: pool.manual,
        targetMonth,
        weekday: prio.weekday,
        rank: prio.rank,
        unlikely: prio.unlikely,
        note: prio.note,
        openDate,
        daysUntilOpen: openDate ? differenceInCalendarDays(openDate, base) : null,
        ruleUnknown,
        label,
      };

      // --- 手順7: 曜日 × 利用月 でグループ化 ---
      const groupKey = `${targetMonth}__${prio.weekday}`;
      const existing = groups.get(groupKey);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(groupKey, {
          key: groupKey,
          targetMonth,
          weekday: prio.weekday,
          items: [item],
          sortDate: null, // あとでまとめて決める
          heading: `${formatMonthJa(targetMonth)}分 ${WEEKDAY_LABEL[prio.weekday]}曜枠`,
        });
      }
    }
  }

  // 仕上げ: グループ内は rank 昇順、グループ同士は「一番早い受付開始日」順
  const result = [...groups.values()];
  for (const g of result) {
    g.items.sort((a, b) => a.rank - b.rank);
    const dates = g.items
      .map((i) => i.openDate)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    g.sortDate = dates[0] ?? null;
  }

  result.sort((a, b) => {
    // 日付が決まらないもの（＝調査が必要なもの）は最後に回す
    if (a.sortDate && b.sortDate) return a.sortDate.getTime() - b.sortDate.getTime();
    if (a.sortDate) return -1;
    if (b.sortDate) return 1;
    return a.key < b.key ? -1 : 1;
  });

  return result;
}

/**
 * 手順6: 予約方法に応じた表示文言を作る。
 *   email  → 「イリアスの担当者にメール（9月分 火曜枠）」
 *   phone  → 「アクオンの担当者に電話（11月分 土曜枠）」
 *   web    → 「伏見港をWebで申込（11月分 土曜枠）」
 *   counter→ 「踏水会の窓口で申込（11月分 土曜枠）」
 */
function buildLabel(
  pool: PoolRow,
  targetMonth: string,
  weekday: number,
  ruleUnknown: boolean,
): string {
  const monthNum = parseMonthString(targetMonth).getMonth() + 1;
  const suffix = `（${monthNum}月分 ${WEEKDAY_LABEL[weekday]}曜枠）`;

  // 予約方法が未調査なら、まず調べることがタスクになる
  if (pool.method === "unknown") {
    return `${pool.name}の予約方法を調査${suffix}`;
  }
  // 方法は分かっているが受付開始ルールが未設定のケース
  if (ruleUnknown) {
    return `${pool.name}の受付開始ルールを調査${suffix}`;
  }

  switch (pool.method) {
    case "email":
      return `${pool.name}の担当者にメール${suffix}`;
    case "phone":
      return `${pool.name}の担当者に電話${suffix}`;
    case "web":
      return `${pool.name}をWebで申込${suffix}`;
    case "counter":
      return `${pool.name}の窓口で申込${suffix}`;
  }
}

/** 「第1候補」「第2候補」…の表示。rank=0 は特別扱い */
export function rankLabel(item: AutoTaskItem): string {
  if (item.rank === 0 && item.unlikely) return "望み薄・一応確認";
  if (item.rank === 0) return "一応確認";
  return `第${item.rank}候補`;
}

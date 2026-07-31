import type { EventType, Priority, RuleType, BookingMethod } from "./types";

/**
 * 入力チェックをまとめた場所。
 *
 * なぜ route.ts に直接書かないのか:
 *   Next.js の route.ts は「GET/POST など決まった名前しか export してはいけない」
 *   というルールがあります。共通関数を置くと build エラーになるので、
 *   こういう補助関数は lib/ 側に分けます。
 */

const EVENT_TYPES: EventType[] = ["practice", "event", "off"];
const PRIORITIES: Priority[] = ["high", "mid", "low"];
const RULE_TYPES: RuleType[] = ["months_before", "fixed_day", "unknown"];
const METHODS: BookingMethod[] = ["email", "phone", "web", "counter", "unknown"];

export const isDateString = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export const isMonthString = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}$/.test(v);

export const isEventType = (v: unknown): v is EventType =>
  typeof v === "string" && EVENT_TYPES.includes(v as EventType);

export const isPriority = (v: unknown): v is Priority =>
  typeof v === "string" && PRIORITIES.includes(v as Priority);

export const isRuleType = (v: unknown): v is RuleType =>
  typeof v === "string" && RULE_TYPES.includes(v as RuleType);

export const isMethod = (v: unknown): v is BookingMethod =>
  typeof v === "string" && METHODS.includes(v as BookingMethod);

export const isNonEmpty = (v: unknown): v is string =>
  typeof v === "string" && v.trim() !== "";

/** events の入力チェック。問題があればメッセージ、無ければ null */
export function validateEventInput(body: {
  date?: unknown;
  type?: unknown;
  title?: unknown;
}): string | null {
  if (!isDateString(body.date)) return "日付を YYYY-MM-DD 形式で指定してください";
  if (!isEventType(body.type)) return "種別は 練習 / イベント / オフ のいずれかです";
  if (!isNonEmpty(body.title)) return "タイトルを入力してください";
  return null;
}

/** tasks の入力チェック */
export function validateTaskInput(body: {
  title?: unknown;
  priority?: unknown;
  due_date?: unknown;
}): string | null {
  if (!isNonEmpty(body.title)) return "タイトルを入力してください";
  if (!isPriority(body.priority)) return "優先度は 高 / 中 / 低 のいずれかです";
  if (body.due_date != null && body.due_date !== "" && !isDateString(body.due_date)) {
    return "期日を YYYY-MM-DD 形式で指定してください";
  }
  return null;
}

/** pools の入力チェック */
export function validatePoolInput(body: {
  name?: unknown;
  method?: unknown;
  rule_type?: unknown;
  rule_value?: unknown;
  lead_days?: unknown;
}): string | null {
  if (!isNonEmpty(body.name)) return "プール名を入力してください";
  if (!isMethod(body.method)) return "予約方法が不正です";
  if (!isRuleType(body.rule_type)) return "受付ルールの種類が不正です";

  if (body.rule_type === "months_before") {
    const n = Number(body.rule_value);
    if (!Number.isInteger(n) || n < 0 || n > 24) {
      return "「Nか月前」の N は 0〜24 の整数で入力してください";
    }
  }
  if (body.rule_type === "fixed_day") {
    const n = Number(body.rule_value);
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      return "「毎月N日」の N は 1〜31 の整数で入力してください";
    }
  }
  if (body.lead_days != null) {
    const n = Number(body.lead_days);
    if (!Number.isInteger(n) || n < 0 || n > 180) {
      return "何日前から表示するかは 0〜180 の整数で入力してください";
    }
  }
  return null;
}

/** pool_priorities の入力チェック */
export function validatePriorityInput(body: {
  pool_id?: unknown;
  weekday?: unknown;
  start_month?: unknown;
  end_month?: unknown;
  rank?: unknown;
}): string | null {
  if (!isNonEmpty(body.pool_id)) return "プールを選んでください";

  const wd = Number(body.weekday);
  if (!Number.isInteger(wd) || wd < 0 || wd > 6) return "曜日が不正です";

  const sm = Number(body.start_month);
  const em = Number(body.end_month);
  if (!Number.isInteger(sm) || sm < 1 || sm > 12) return "開始月は 1〜12 です";
  if (!Number.isInteger(em) || em < 1 || em > 12) return "終了月は 1〜12 です";

  const rank = Number(body.rank);
  if (!Number.isInteger(rank) || rank < 0) return "順位は 0 以上の整数です";
  return null;
}

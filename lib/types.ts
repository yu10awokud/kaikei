// DB のテーブル構造を TypeScript の型として書き写したもの。
// Supabase から取ってきたデータにこの型を付けることで、
// 「typo したカラム名」や「null チェック忘れ」をエディタが指摘してくれます。

export type EventType = "practice" | "event" | "off";

export type EventRow = {
  id: string;
  date: string; // 'YYYY-MM-DD'（date 型は文字列として返ってきます）
  type: EventType;
  title: string;
  start_time: string | null; // 'HH:MM:SS'
  end_time: string | null;
  place: string | null;
  memo: string | null;
  created_at: string;
};

export type Priority = "high" | "mid" | "low";

export type TaskRow = {
  id: string;
  title: string;
  priority: Priority;
  due_date: string | null;
  memo: string | null;
  done: boolean;
  created_at: string;
};

export type BookingMethod = "email" | "phone" | "web" | "counter" | "unknown";
export type RuleType = "months_before" | "fixed_day" | "unknown";

export type PoolRow = {
  id: string;
  name: string;
  method: BookingMethod;
  contact: string | null;
  staff_name: string | null;
  rule_type: RuleType;
  rule_value: number | null;
  lead_days: number;
  manual: string | null;
  active: boolean;
};

export type PoolPriorityRow = {
  id: string;
  pool_id: string;
  weekday: number; // 0=日 〜 6=土
  start_month: number; // 1-12
  end_month: number; // 1-12
  rank: number;
  unlikely: boolean;
  note: string | null;
};

export type RoutineResult = "booked" | "failed" | "skipped";

export type RoutineLogRow = {
  id: string;
  pool_id: string;
  target_month: string; // 'YYYY-MM'
  weekday: number;
  result: RoutineResult;
  done_at: string;
  note: string | null;
};

// ---- 画面表示用のラベル（日本語化を1か所にまとめる） ----

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  practice: "練習",
  event: "イベント",
  off: "オフ",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "高",
  mid: "中",
  low: "低",
};

export const METHOD_LABEL: Record<BookingMethod, string> = {
  email: "メール",
  phone: "電話",
  web: "Web",
  counter: "窓口",
  unknown: "未調査",
};

export const RULE_TYPE_LABEL: Record<RuleType, string> = {
  months_before: "利用月のNか月前の1日から受付",
  fixed_day: "毎月N日が申込日・締切日",
  unknown: "未調査",
};

export const WEEKDAY_LABEL = ["日", "月", "火", "水", "木", "金", "土"];

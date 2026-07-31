import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  getDay,
  parseISO,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";

/**
 * 日付まわりの共通関数。
 *
 * ポイント: DB の date 型は 'YYYY-MM-DD' という「タイムゾーンを持たない文字列」です。
 * new Date('2026-09-01') と書くと UTC 解釈されて日本時間では8/31になる事故が起きるので、
 * 文字列 ⇔ Date の変換は必ずここの関数を通します。
 */

/** 'YYYY-MM-DD' → Date（ローカルタイムの0時。ズレない） */
export function parseDateString(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Date → 'YYYY-MM-DD' */
export function toDateString(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Date → 'YYYY-MM'（利用月の表現に使う） */
export function toMonthString(d: Date): string {
  return format(d, "yyyy-MM");
}

/** 'YYYY-MM' → その月の1日の Date */
export function parseMonthString(s: string): Date {
  const [y, m] = s.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

/**
 * 「今日」を日本時間で求める（時刻は0時に切り落とす）。
 *
 * 【なぜ new Date() をそのまま使わないのか】
 * Vercel のサーバーはタイムゾーンが UTC です。日本時間の朝8時は UTC では前日23時なので、
 * new Date().getDate() をそのまま使うと「サーバーだけ1日前」になる時間帯が生まれます。
 * 受付開始日の判定が1日ずれると予約を取り逃すので、明示的に Asia/Tokyo で計算します。
 *
 * Intl.DateTimeFormat の 'en-CA' ロケールは 'YYYY-MM-DD' 形式を返してくれるので、
 * これを分解して「日本時間での年月日」を得ています。
 */
export function today(): Date {
  const jst = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = jst.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * 【重要】月が start_month〜end_month の範囲に入るかを判定する。
 *
 * start_month <= end_month のときは素直な範囲判定。
 *   例) start=5, end=8 → 5,6,7,8月
 *
 * start_month > end_month のときは「年をまたぐ」意味になる。
 *   例) start=9, end=4 → 9,10,11,12,1,2,3,4月
 *   このケースは「9月以降」または「4月以前」のどちらかに当てはまればOK、と考える。
 *
 * pool_priorities の季節判定は必ずこの関数を通すこと。
 */
export function isMonthInRange(
  month: number,
  startMonth: number,
  endMonth: number,
): boolean {
  if (startMonth <= endMonth) {
    return month >= startMonth && month <= endMonth;
  }
  // 年またぎ
  return month >= startMonth || month <= endMonth;
}

/** 範囲を「9〜4月」のように表示する。年またぎのときは注記を付ける。 */
export function formatMonthRange(startMonth: number, endMonth: number): string {
  const base = `${startMonth}〜${endMonth}月`;
  return startMonth <= endMonth ? base : `${base}（年またぎ）`;
}

/**
 * 「利用月」に対する受付開始日を計算する。
 *
 *  - months_before: 利用月の rule_value か月前の「1日」
 *      例) 利用月=2026-09, rule_value=3 → 2026-06-01
 *  - fixed_day:     利用月の「前月」の rule_value 日
 *      例) 利用月=2026-11, rule_value=15 → 2026-10-15
 *      （前月に存在しない日を指定された場合は月末に丸める。例: 31日 → 2月なら28/29日）
 *  - unknown:       日付が決まらないので null
 */
export function calcOpenDate(
  ruleType: string,
  ruleValue: number | null,
  targetMonth: string,
): Date | null {
  const monthStart = parseMonthString(targetMonth);

  if (ruleType === "months_before") {
    if (ruleValue == null) return null;
    return startOfMonth(subMonths(monthStart, ruleValue));
  }

  if (ruleType === "fixed_day") {
    if (ruleValue == null) return null;
    const prev = subMonths(monthStart, 1);
    const lastDay = endOfMonth(prev).getDate();
    const day = Math.min(Math.max(ruleValue, 1), lastDay);
    return new Date(prev.getFullYear(), prev.getMonth(), day);
  }

  return null; // unknown
}

/** 受付開始日の lead_days 日前（＝TOPに出し始める日）を返す */
export function calcVisibleFrom(openDate: Date, leadDays: number): Date {
  return subDays(openDate, leadDays);
}

/** 今日から見た残り日数（正=未来、0=今日、負=過去） */
export function daysFromToday(d: Date): number {
  return differenceInCalendarDays(d, today());
}

/** 今月・翌月・翌々月の 'YYYY-MM' を返す（自動タスクの対象となる利用月） */
export function upcomingTargetMonths(base: Date = today(), count = 3): string[] {
  return Array.from({ length: count }, (_, i) => toMonthString(addMonths(base, i)));
}

/** 指定した年月の、指定曜日の日付をすべて返す（曜日まとめ登録で使用） */
export function datesOfWeekdayInMonth(
  year: number,
  month: number, // 1-12
  weekday: number, // 0=日 〜 6=土
): Date[] {
  const first = new Date(year, month - 1, 1);
  const last = endOfMonth(first);
  const result: Date[] = [];
  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(year, month - 1, d);
    if (getDay(date) === weekday) result.push(date);
  }
  return result;
}

/**
 * カレンダー表示用に、月曜始まり…ではなく「日曜始まり」6週分のマス目を作る。
 * 前月・翌月の日も含めて必ず 7×6 = 42 マスにすることで、
 * 月が変わってもカレンダーの高さが変動しません。
 */
export function buildCalendarGrid(year: number, month: number): Date[] {
  const first = new Date(year, month - 1, 1);
  const startOffset = getDay(first); // 1日が何曜日か
  const gridStart = new Date(year, month - 1, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

/** 'HH:MM:SS' → 'HH:MM'（DB の time 型は秒まで返ってくるので表示用に削る） */
export function trimSeconds(t: string | null): string {
  if (!t) return "";
  return t.slice(0, 5);
}

/** '2026-09' → '2026年9月' */
export function formatMonthJa(monthStr: string): string {
  const d = parseMonthString(monthStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

/** Date → '9/1(火)' */
export function formatShortJa(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}(${["日", "月", "火", "水", "木", "金", "土"][d.getDay()]})`;
}

export { parseISO, format, addMonths, subMonths, startOfMonth, endOfMonth };

// ============================================================
// 日付ユーティリティ
//   'YYYY-MM-DD' の文字列を基本の型として扱う。
//   new Date('2026-08-01') は UTC 扱いで時差ズレが起きるため、
//   文字列 → 数値の分解で計算する。
// ============================================================

export const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'] as const;

const MONTH_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** 数値を 2 桁にそろえる（8 → '08'） */
const pad = (n: number) => String(n).padStart(2, '0');

/** Date → 'YYYY-MM-DD'（ローカル時間で） */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' → ローカル時間の Date */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 今日の 'YYYY-MM-DD' */
export function todayKey(): string {
  return toDateKey(new Date());
}

/** 年月から 'August 2026' 形式の見出しを作る */
export function formatMonthTitle(year: number, month: number): string {
  return `${MONTH_EN[month - 1]} ${year}`;
}

/** 'YYYY-MM-DD' → '8/1（土）' */
export function formatDateWithWeekday(key: string): string {
  const d = fromDateKey(key);
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAY_JA[d.getDay()]}）`;
}

/** その月の日数 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 月の初日・末日を 'YYYY-MM-DD' で返す */
export function monthRange(year: number, month: number): { start: string; end: string } {
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`,
  };
}

/** 前の月 / 次の月 */
export function addMonths(year: number, month: number, diff: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + diff;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

/**
 * 月表示カレンダー用のマス目を作る（日曜始まり・6 週 42 マス固定）。
 * 前後の月の日も含めて返し、inMonth で当月かどうかを判定できるようにする。
 */
export type CalendarCell = { key: string; day: number; inMonth: boolean; weekday: number };

export function buildCalendarCells(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month - 1, 1);
  const startOffset = first.getDay(); // 0=日曜
  const cells: CalendarCell[] = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month - 1, 1 - startOffset + i);
    cells.push({
      key: toDateKey(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month - 1,
      weekday: d.getDay(),
    });
  }
  return cells;
}

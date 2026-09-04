// ============================================================
// 表示のための小さな整形関数
//   金額は必ず整数（円）で扱う。小数は一切使わない。
// ============================================================

/** 1234567 → '¥1,234,567' */
export function formatYen(amount: number): string {
  return `¥${Math.trunc(amount).toLocaleString('ja-JP')}`;
}

/** '2026-09-01' → '9月1日(火)' */
export function formatDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const week = ['日', '月', '火', '水', '木', '金', '土'][dt.getDay()];
  return `${m}月${d}日(${week})`;
}

/** '2026-09-01' → '2026年9月1日(火)' */
export function formatDateFull(dateKey: string): string {
  const [y] = dateKey.split('-').map(Number);
  return `${y}年${formatDate(dateKey)}`;
}

/** Date → 'YYYY-MM-DD'（ブラウザのタイムゾーンのまま素直に作る） */
export function toDateKey(dt: Date): string {
  const y = dt.getFullYear();
  const m = `${dt.getMonth() + 1}`.padStart(2, '0');
  const d = `${dt.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 今日から days 日ずらした 'YYYY-MM-DD' */
export function shiftDateKey(days: number, base = new Date()): string {
  const dt = new Date(base);
  dt.setDate(dt.getDate() + days);
  return toDateKey(dt);
}

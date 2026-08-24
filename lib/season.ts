// ============================================================
// シーズン計算ロジック
//   シーズンは 9 月始まり：9/1 〜 翌年 8/31 が 1 シーズン
//   表記は「2026-2027シーズン」形式
// ============================================================

/** シーズンの開始月（9 月） */
export const SEASON_START_MONTH = 9;

/** シーズンを表すキー（'2026-2027' の形） */
export type SeasonKey = string;

/**
 * 'YYYY-MM-DD' の日付が属するシーズンキーを返す。
 * 例: 2026-09-01 〜 2027-08-31 → '2026-2027'
 */
export function getSeasonKeyFromDate(date: string | Date): SeasonKey {
  const { year, month } = splitDate(date);
  // 1〜8 月は「前年始まりのシーズン」に属する
  const startYear = month >= SEASON_START_MONTH ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

/** 現在（今日）のシーズンキー */
export function getCurrentSeasonKey(today: Date = new Date()): SeasonKey {
  return getSeasonKeyFromDate(today);
}

/** シーズンキーから開始年を取り出す（'2026-2027' → 2026） */
export function getSeasonStartYear(season: SeasonKey): number {
  return Number(season.split('-')[0]);
}

/** 表示用ラベル（'2026-2027' → '2026-2027シーズン'） */
export function formatSeasonLabel(season: SeasonKey): string {
  return `${season}シーズン`;
}

/** シーズンの期間を 'YYYY-MM-DD' で返す */
export function getSeasonRange(season: SeasonKey): { start: string; end: string } {
  const startYear = getSeasonStartYear(season);
  return {
    start: `${startYear}-09-01`,
    end: `${startYear + 1}-08-31`,
  };
}

/** その日付が指定シーズンに含まれるか */
export function isInSeason(date: string | Date, season: SeasonKey): boolean {
  return getSeasonKeyFromDate(date) === season;
}

/**
 * 日付の配列から、含まれるシーズンキーの一覧を新しい順で返す。
 * 現在のシーズンが含まれていなければ先頭に足す（データ 0 件でも表示するため）。
 */
export function listSeasonKeys(dates: (string | Date)[], today: Date = new Date()): SeasonKey[] {
  const set = new Set<SeasonKey>(dates.map(getSeasonKeyFromDate));
  set.add(getCurrentSeasonKey(today));
  return Array.from(set).sort((a, b) => getSeasonStartYear(b) - getSeasonStartYear(a));
}

// --- 内部ヘルパー ------------------------------------------------

/**
 * 'YYYY-MM-DD' 文字列は Date に変換せずそのまま数値化する。
 * （new Date('2026-09-01') は UTC 扱いになり、時差でシーズンがずれるため）
 */
function splitDate(date: string | Date): { year: number; month: number; day: number } {
  if (typeof date === 'string') {
    const [y, m, d] = date.split('-').map(Number);
    return { year: y, month: m, day: d };
  }
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

// ============================================================
// DB のテーブルに対応する型定義
// （supabase/schema.sql と 1 対 1 で対応しています）
// ============================================================

/** 割り当ての枠。all_day = 終日、am = 午前、pm = 午後（二部練のとき） */
export type Slot = 'all_day' | 'am' | 'pm';

export const SLOT_LABEL: Record<Slot, string> = {
  all_day: '終日',
  am: '午前',
  pm: '午後',
};

/** 部員マスタ */
export type Member = {
  id: string;
  name: string;
  color: string; // HEX（例 #E4572E）
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** 練習場所マスタ */
export type Place = {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  /** true = 「オフ（練習なし）」用の場所。担当者欄を出さずに表示する */
  is_off: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** 担当の割り当て（1 行 = ある日のある枠） */
export type Assignment = {
  id: string;
  date: string; // 'YYYY-MM-DD'
  slot: Slot;
  member_id: string | null; // null = 担当者未定（正常な状態）
  place_id: string | null; // null = 場所未定
  note: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

/** 画面表示用に、部員名と場所名を埋めた割り当て */
export type AssignmentView = Assignment & {
  member: Pick<Member, 'id' | 'name' | 'color'> | null;
  place: Pick<Place, 'id' | 'name' | 'color' | 'is_off'> | null;
};

/** 担当率タブで使う集計結果の 1 行 */
export type RatioRow = {
  memberId: string;
  name: string;
  color: string;
  count: number;
  percent: number; // 0〜100
};

/** 1 シーズン分の集計結果 */
export type SeasonSummary = {
  season: string; // '2026-2027'
  label: string; // '2026-2027シーズン'
  total: number; // 担当者が決まっている件数の合計
  unassigned: number; // 担当者未定の件数
  rows: RatioRow[];
};

/** 更新履歴（バージョン管理） */
export type ReleaseCategory = 'major' | 'fix';

export const RELEASE_CATEGORY_LABEL: Record<ReleaseCategory, string> = {
  major: '主要更新',
  fix: '修正',
};

export type Release = {
  id: string;
  version: string;
  released_on: string; // 'YYYY-MM-DD'
  category: ReleaseCategory;
  /** 1 行 1 項目。改行で区切って保存する */
  notes: string;
  author: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

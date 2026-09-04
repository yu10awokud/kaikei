// ============================================================
// このアプリで使う型定義
//   ・practices 系 … 既存サイト（メニュー特戦隊）のテーブルを読むだけ
//   ・expenses     … このアプリが新しく作るテーブル
// ============================================================

/** 練習の枠。all_day = 終日、am = 午前、pm = 午後（二部練） */
export type Slot = 'all_day' | 'am' | 'pm';

export const SLOT_LABEL: Record<Slot, string> = {
  all_day: '終日',
  am: '午前',
  pm: '午後',
};

/**
 * 画面に出す練習1コマ。
 * 既存カレンダーから「日付」と「練習場所」だけを取り出したもの。
 * メニュー担当者は取得も表示もしない。
 */
export type Practice = {
  /** 既存 assignments テーブルの id。立替との紐付けに使う */
  id: string;
  date: string; // 'YYYY-MM-DD'
  slot: Slot;
  location: string; // 練習場所の名前（未設定なら '場所未定'）
  /** 練習場所の色（既存サイトの場所マスタで決めている色） */
  color: string;
  /** オフ（練習なし）の日か */
  isOff: boolean;
};

/** 立替の項目（カテゴリ） */
export type Category = 'club_fee' | 'prepaid' | 'support_fee' | 'other';

export const CATEGORY_LABEL: Record<Category, string> = {
  club_fee: '部費立替',
  prepaid: 'プリペイド立替',
  support_fee: '後援会費立替',
  other: 'その他',
};

/** 選択肢を画面に並べるときの順番 */
export const CATEGORY_ORDER: Category[] = ['club_fee', 'prepaid', 'support_fee', 'other'];

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && value in CATEGORY_LABEL;
}

/** 精算の状況 */
export type ExpenseStatus = 'unsettled' | 'settled';

/** 立替の記録 1 件（DB の expenses テーブルと 1 対 1） */
export type Expense = {
  id: string;
  assignment_id: string | null;
  event_date: string; // 'YYYY-MM-DD'
  event_slot: Slot;
  event_location: string;
  payer_id: string | null;
  payer_name: string;
  amount: number; // 円・整数
  category: Category;
  category_other: string | null;
  needs_refund: boolean;
  status: ExpenseStatus;
  settled_at: string | null;
  memo: string | null;
  receipt_path: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

/** 部員マスタ（既存テーブル。立替者を選ぶプルダウンに使う） */
export type Member = {
  id: string;
  name: string;
};

/** 項目の表示名。その他のときは自由記述の中身を出す */
export function categoryLabel(e: Pick<Expense, 'category' | 'category_other'>): string {
  if (e.category === 'other') return e.category_other?.trim() || 'その他';
  return CATEGORY_LABEL[e.category];
}

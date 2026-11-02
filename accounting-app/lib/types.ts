// ============================================================
// データの型と表示名
// ============================================================

export type Fund = 'club_fee' | 'prepaid' | 'supporters';
export type Direction = 'income' | 'expense';
export type AccountKind = 'cash' | 'club_bank' | 'advance';
export type PaymentMode = 'per_visit' | 'monthly';

export const FUND_LABELS: Record<Fund, string> = {
  club_fee: '部費',
  prepaid: 'プリペイド',
  supporters: '後援会費',
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  income: '収入',
  expense: '支出',
};

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  cash: '現金',
  club_bank: '部活口座',
  advance: '立替',
};

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  per_visit: '都度払い',
  monthly: '月締め振込',
};

export type Account = { id: number; name: string; kind: AccountKind; sort_order: number; is_active: boolean };
export type Facility = { id: number; name: string; payment_mode: PaymentMode; sort_order: number; is_active: boolean };
export type TransactionType = { id: number; name: string; code: string | null; sort_order: number; is_active: boolean };
export type Member = { id: number; name: string; sort_order: number; is_active: boolean };

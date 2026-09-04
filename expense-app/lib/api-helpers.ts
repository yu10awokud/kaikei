import { NextResponse } from 'next/server';
import { getSupabaseAdmin, NOT_CONFIGURED } from '@/lib/supabase-server';
import { parseAmount } from '@/lib/amount';
import { isCategory, type Slot } from '@/lib/types';

// ============================================================
// Route Handler（サーバー側 API）で共通に使う小さな道具たち
// ============================================================

export type Json = Record<string, unknown>;

export function ok(data: unknown) {
  return NextResponse.json(data);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** 環境変数が未設定なら 503 を返す。設定済みならクライアントを返す。 */
export function requireClient() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { supabase: null, response: NextResponse.json(NOT_CONFIGURED, { status: 503 }) };
  }
  return { supabase, response: null };
}

/** リクエストの JSON を安全に読む */
export async function readJson(req: Request): Promise<Json> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Json) : {};
  } catch {
    return {};
  }
}

/** 'YYYY-MM-DD' として正しいか */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function isSlot(value: unknown): value is Slot {
  return value === 'all_day' || value === 'am' || value === 'pm';
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isUuidOrNull(value: unknown): value is string | null {
  if (value === null || value === undefined) return true;
  return isUuid(value);
}

/** 文字列を整えて返す（空文字は null） */
export function cleanText(value: unknown, maxLength = 200): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed === '' ? null : trimmed;
}

/** 立替1件分の入力を検証して、DB に入れられる形にそろえる */
export function validateExpenseInput(body: Json) {
  const amount = parseAmount(body.amount);
  if (amount === null) {
    return { error: '金額は 1 以上の整数（円）で入力してください。小数は使えません。' };
  }

  if (!isCategory(body.category)) return { error: '項目の指定が正しくありません。' };
  const categoryOther = cleanText(body.category_other, 60);
  if (body.category === 'other' && !categoryOther) {
    return { error: '「その他」を選んだときは、項目の内容を入力してください。' };
  }

  const payerName = cleanText(body.payer_name, 40);
  if (!payerName) return { error: '立て替えた人を選んでください。' };
  if (!isUuidOrNull(body.payer_id)) return { error: '立て替えた人の指定が正しくありません。' };

  if (!isDateKey(body.event_date)) return { error: '練習日の形式が正しくありません。' };
  if (!isSlot(body.event_slot)) return { error: '練習の枠の指定が正しくありません。' };
  if (!isUuidOrNull(body.assignment_id)) return { error: '練習の指定が正しくありません。' };

  const needsRefund = body.needs_refund !== false; // 既定は「返金が必要」

  return {
    value: {
      assignment_id: (body.assignment_id as string | null) ?? null,
      event_date: body.event_date,
      event_slot: body.event_slot,
      event_location: cleanText(body.event_location, 60) ?? '',
      payer_id: (body.payer_id as string | null) ?? null,
      payer_name: payerName,
      amount,
      category: body.category,
      category_other: body.category === 'other' ? categoryOther : null,
      needs_refund: needsRefund,
      // 返金不要のものは最初から精算済み扱いにして、未精算の集計に混ぜない
      status: needsRefund ? 'unsettled' : 'settled',
      memo: cleanText(body.memo, 300),
      receipt_path: cleanText(body.receipt_path, 300),
    },
  };
}

/** Supabase のエラーを分かりやすいメッセージに変換 */
export function toMessage(error: { message?: string } | null): string {
  const raw = error?.message ?? '不明なエラーが発生しました';
  if (raw.includes('expenses_other_needs_text')) {
    return '「その他」を選んだときは、項目の内容を入力してください。';
  }
  if (raw.includes('expenses_amount_check') || raw.includes('amount > 0')) {
    return '金額は 1 円以上で入力してください。';
  }
  if (raw.includes('relation "public.expenses" does not exist')) {
    return 'expenses テーブルがまだ作られていません。README の手順に沿って supabase/migration-expenses.sql を実行してください。';
  }
  if (raw.includes('Bucket not found')) {
    return '領収書の保存先（receipts バケット）が見つかりません。supabase/migration-expenses.sql を実行してください。';
  }
  if (raw.includes('Invalid path specified in request URL')) {
    return 'Supabase の接続先URLが正しくありません。NEXT_PUBLIC_SUPABASE_URL が「https://〇〇.supabase.co」の形になっているか確認してください。';
  }
  if (raw.includes('Invalid API key') || raw.includes('JWSError')) {
    return 'Supabase のキーが正しくありません。SUPABASE_SERVICE_ROLE_KEY を確認してください。';
  }
  return raw;
}

/** 生きている立替を取るときの共通 select */
export const EXPENSE_SELECT =
  'id, assignment_id, event_date, event_slot, event_location, payer_id, payer_name, amount, ' +
  'category, category_other, needs_refund, status, settled_at, memo, receipt_path, ' +
  'is_deleted, created_at, updated_at';

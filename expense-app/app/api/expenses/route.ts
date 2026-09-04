import {
  ok, fail, requireClient, readJson, isDateKey, isUuid,
  validateExpenseInput, toMessage, EXPENSE_SELECT,
} from '@/lib/api-helpers';
import { RECEIPT_BUCKET } from '@/lib/supabase-server';
import type { Expense } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const SIGNED_URL_EXPIRES_IN = 60 * 30;

/**
 * 一覧に出す領収書のサムネイル用に、非公開バケットの一時URLをまとめて作る。
 * 失敗しても一覧そのものは出したいので、エラーは握りつぶして空を返す。
 */
async function signReceipts(
  supabase: SupabaseClient,
  rows: Expense[],
): Promise<Record<string, string>> {
  const paths = [...new Set(rows.map((r) => r.receipt_path).filter((p): p is string => !!p))];
  if (paths.length === 0) return {};

  const { data, error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_EXPIRES_IN);
  if (error) return {};

  const urls: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return urls;
}

// ------------------------------------------------------------
// GET /api/expenses
//   ?from / ?to        期間で絞り込み（練習日で判定）
//   ?payer=<uuid>      立て替えた人で絞り込み
//   ?assignment=<uuid> ある練習の立替だけ
//   ?status=unsettled  未精算だけ
// ------------------------------------------------------------
export async function GET(req: Request) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const payer = url.searchParams.get('payer');
  const assignment = url.searchParams.get('assignment');
  const status = url.searchParams.get('status');

  let query = supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('is_deleted', false)
    .order('event_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (from && isDateKey(from)) query = query.gte('event_date', from);
  if (to && isDateKey(to)) query = query.lte('event_date', to);
  if (payer && isUuid(payer)) query = query.eq('payer_id', payer);
  if (assignment && isUuid(assignment)) query = query.eq('assignment_id', assignment);
  if (status === 'unsettled' || status === 'settled') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return fail(toMessage(error), 502);

  const expenses = (data ?? []) as unknown as Expense[];
  return ok({ expenses, receiptUrls: await signReceipts(supabase, expenses) });
}

// ------------------------------------------------------------
// POST /api/expenses   立替を1件記録する
// ------------------------------------------------------------
export async function POST(req: Request) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const body = await readJson(req);
  const { value, error: invalid } = validateExpenseInput(body);
  if (invalid || !value) return fail(invalid ?? '入力内容が正しくありません。');

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      ...value,
      // 返金不要のものは記録した時点で精算済み扱いにする
      settled_at: value.status === 'settled' ? new Date().toISOString() : null,
    })
    .select(EXPENSE_SELECT)
    .single();

  if (error) return fail(toMessage(error), 400);
  return ok({ expense: data });
}

import { fail, requireClient, isDateKey, isUuid, toMessage, EXPENSE_SELECT } from '@/lib/api-helpers';
import { CATEGORY_LABEL, SLOT_LABEL, type Expense } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** CSV の1マス分を安全に囲む（カンマ・改行・引用符が入っていても壊れないように） */
function cell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

const HEADER = [
  '練習日', '枠', '練習場所', '立替者', '金額(円)', '項目',
  '返金の有無', '精算状況', 'メモ', '領収書', '登録日時',
];

// ------------------------------------------------------------
// GET /api/expenses/csv?from=&to=&payer=&status=
//   立替一覧を CSV でダウンロードする。
//   Excel で開いても文字化けしないよう UTF-8 の BOM を先頭に付ける。
// ------------------------------------------------------------
export async function GET(req: Request) {
  const { supabase, response } = requireClient();
  if (!supabase) return response;

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const payer = url.searchParams.get('payer');
  const status = url.searchParams.get('status');

  let query = supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('is_deleted', false)
    .order('event_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (from && isDateKey(from)) query = query.gte('event_date', from);
  if (to && isDateKey(to)) query = query.lte('event_date', to);
  if (payer && isUuid(payer)) query = query.eq('payer_id', payer);
  if (status === 'unsettled' || status === 'settled') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return fail(toMessage(error), 502);

  const rows = ((data ?? []) as unknown as Expense[]).map((e) =>
    [
      cell(e.event_date),
      cell(SLOT_LABEL[e.event_slot]),
      cell(e.event_location),
      cell(e.payer_name),
      // 金額は数値のまま出す（Excel でそのまま合計できるように）
      String(e.amount),
      cell(e.category === 'other' ? e.category_other ?? 'その他' : CATEGORY_LABEL[e.category]),
      cell(e.needs_refund ? '必要' : '不要'),
      cell(e.needs_refund ? (e.status === 'settled' ? '精算済み' : '未精算') : '—'),
      cell(e.memo),
      cell(e.receipt_path ? 'あり' : 'なし'),
      cell(e.created_at),
    ].join(','),
  );

  const csv = `﻿${[HEADER.map(cell).join(','), ...rows].join('\r\n')}\r\n`;
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tatekae-${today}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

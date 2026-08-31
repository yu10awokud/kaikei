import { NextResponse } from 'next/server';
import { getSupabaseAdmin, NOT_CONFIGURED } from '@/lib/supabase-server';
import type { Slot } from '@/lib/types';

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

/** uuid か（null も許可する場合は allowNull = true） */
export function isUuidOrNull(value: unknown): value is string | null {
  if (value === null || value === undefined) return true;
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** HEX カラー（#RRGGBB）か */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** 文字列を整えて返す（空文字は null） */
export function cleanText(value: unknown, maxLength = 200): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed === '' ? null : trimmed;
}

/** Supabase のエラーを分かりやすいメッセージに変換 */
export function toMessage(error: { message?: string } | null): string {
  const raw = error?.message ?? '不明なエラーが発生しました';
  if (raw.includes('SLOT_CONFLICT')) {
    return '同じ日に「終日」と「午前/午後」を同時に登録することはできません。';
  }
  if (raw.includes('assignments_date_slot_key')) {
    return 'その日のその枠には、すでに登録があります。画面を再読み込みしてから操作してください。';
  }
  if (raw.includes('Invalid path specified in request URL')) {
    return 'Supabase の接続先URLが正しくありません。NEXT_PUBLIC_SUPABASE_URL が「https://〇〇.supabase.co」の形（末尾にスラッシュや余計なパスを付けない）になっているか確認してください。';
  }
  if (raw.includes('Invalid API key') || raw.includes('JWSError')) {
    return 'Supabase のキーが正しくありません。SUPABASE_SERVICE_ROLE_KEY を確認してください。';
  }
  if (raw.includes('members_name_key')) return '同じ名前の部員がすでに登録されています。';
  if (raw.includes('places_name_key')) return '同じ名前の練習場所がすでに登録されています。';
  return raw;
}

/** assignments を取得するときの共通 select（部員名・場所名も一緒に取る） */
export const ASSIGNMENT_SELECT =
  'id, date, slot, member_id, custom_member, place_id, note, is_deleted, created_at, updated_at, member:members(id, name, color), place:places(id, name, color, is_off)';

import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// サーバー専用の Supabase クライアント
//   ・SUPABASE_SERVICE_ROLE_KEY はこのファイルの中だけで使う
//   ・'server-only' を import しているので、間違ってブラウザ側の
//     コードから読み込むとビルドエラーになる（保険）
//   ・環境変数が未設定でもビルドが落ちないよう null を返す作りにする
// ============================================================

let cached: SupabaseClient | null = null;

/**
 * 環境変数に入れた URL のゆらぎを吸収する。
 *   ・前後の空白／引用符を取り除く
 *   ・末尾のスラッシュや '/rest/v1' などの余計なパスを取り除く
 *   ・ダッシュボードの URL を貼ってしまった場合も救済する
 */
export function normalizeUrl(raw: string | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const dashboard = parsed.pathname.match(/^\/dashboard\/project\/([a-z0-9]+)/i);
    if (parsed.hostname.endsWith('supabase.com') && dashboard) {
      return `https://${dashboard[1]}.supabase.co`;
    }
    return parsed.origin;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

/** 環境変数がそろっていればクライアントを返す。未設定なら null。 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached) return cached;

  const url = normalizeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** 領収書を入れるストレージのバケット名（非公開バケット） */
export const RECEIPT_BUCKET = 'receipts';

/** 環境変数未設定のときに API から返すエラー内容 */
export const NOT_CONFIGURED = {
  error:
    'Supabase の環境変数が設定されていません。.env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください。',
} as const;

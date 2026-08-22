import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// サーバー専用の Supabase クライアント
//   ・SUPABASE_SERVICE_ROLE_KEY はこのファイルの中だけで使う
//   ・'server-only' を import しているので、
//     間違ってブラウザ側のコードから読み込むとビルドエラーになる（保険）
//   ・環境変数が未設定でもビルドが落ちないよう、null を返す作りにする
// ============================================================

let cached: SupabaseClient | null = null;

/** 環境変数がそろっていればクライアントを返す。未設定なら null。 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** 環境変数がそろっているか（画面に案内を出すために使う） */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** API から返す「未設定です」のエラー内容 */
export const NOT_CONFIGURED = {
  error:
    'Supabase の環境変数が設定されていません。.env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください。',
} as const;

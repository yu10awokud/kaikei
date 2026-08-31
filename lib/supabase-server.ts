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

/**
 * 環境変数に入れた URL のゆらぎを吸収する。
 * （DB接続だけでなく、ファイルの URL を組み立てるときにも使う）
 *   ・前後の空白／引用符を取り除く
 *   ・末尾のスラッシュを取り除く（'…supabase.co/' だと '//rest/v1' になり
 *     「Invalid path specified in request URL」というエラーになるため）
 *   ・'/rest/v1' などのパスを間違って付けていた場合も取り除く
 */
export function normalizeUrl(raw: string | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);

    // ダッシュボードの URL を貼ってしまった場合の救済
    //   https://supabase.com/dashboard/project/xxxx → https://xxxx.supabase.co
    const dashboard = parsed.pathname.match(/^\/dashboard\/project\/([a-z0-9]+)/i);
    if (parsed.hostname.endsWith('supabase.com') && dashboard) {
      return `https://${dashboard[1]}.supabase.co`;
    }

    // ホスト部分だけを取り出す（余計なパスやスラッシュを落とす）
    return parsed.origin;
  } catch {
    // URL として解釈できない場合は、末尾スラッシュだけ落として返す
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

/** 環境変数がそろっているか（画面に案内を出すために使う） */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** API から返す「未設定です」のエラー内容 */
export const NOT_CONFIGURED = {
  error:
    'Supabase の環境変数が設定されていません。.env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください。',
} as const;

// ============================================================
// 環境変数の読み取り（ブラウザ・サーバー共通で使ってよいものだけ）
//   値のゆらぎ（前後の空白、引用符、末尾の / や /rest/v1）を吸収する。
// ============================================================

function normalizeUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    // ダッシュボードの URL を貼ってしまった場合も救済する
    const dashboard = parsed.pathname.match(/^\/dashboard\/project\/([a-z0-9]+)/i);
    if (parsed.hostname.endsWith('supabase.com') && dashboard) {
      return `https://${dashboard[1]}.supabase.co`;
    }
    return parsed.origin;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

/** Supabase の公開設定（URL と anon キー）。未設定なら null */
export function getPublicSupabaseEnv(): { url: string; anonKey: string } | null {
  // NEXT_PUBLIC_ の変数はビルド時に埋め込まれるため、process.env.XXX と直接書く必要がある
  const url = normalizeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^['"]|['"]$/g, '');
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export const ENV_MISSING_MESSAGE =
  'Supabase の環境変数が設定されていません。.env.local（Vercel では Environment Variables）に ' +
  'NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。';

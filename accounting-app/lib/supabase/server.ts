import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getPublicSupabaseEnv } from '@/lib/env';

// ============================================================
// ログイン中のユーザーとして Supabase に接続するクライアント（サーバー用）
//   anon キー＋ログインのクッキーで接続するので、RLS が必ず効く。
//   画面表示・API の読み書きは基本的すべてこれを使う。
// ============================================================
export async function createSupabaseServerClient() {
  const env = getPublicSupabaseEnv();
  if (!env) return null;

  const cookieStore = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component からは書き込めない。middleware が更新するので無視してよい
        }
      },
    },
  });
}

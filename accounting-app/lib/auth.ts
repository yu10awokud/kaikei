import 'server-only';
import { cache } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// ============================================================
// ログイン状態と「使ってよい人か（allowed_users）」の確認
//   cache() で 1 リクエスト内の重複問い合わせをまとめる。
// ============================================================

export type AuthState =
  | { status: 'not_configured' }
  | { status: 'signed_out' }
  | { status: 'forbidden'; email: string }
  | {
      status: 'ok';
      email: string;
      supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
    };

export const getAuthState = cache(async (): Promise<AuthState> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: 'not_configured' };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'signed_out' };

  const email = (user.email ?? '').toLowerCase();
  const { data: allowed, error } = await supabase.rpc('is_allowed_user');
  if (error || allowed !== true) return { status: 'forbidden', email };

  return { status: 'ok', email, supabase };
});

/** ログイン後の移動先として安全なパスか（外部サイトへの転送を防ぐ） */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}

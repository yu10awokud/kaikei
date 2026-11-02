import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/auth';

// ============================================================
// Google ログインから戻ってきたときの処理
//   1. 受け取ったコードをセッション（ログイン状態）に交換する
//   2. allowed_users に入っていない人はその場でログアウトさせて拒否する
// ============================================================
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));

  const toLogin = (error: string) => NextResponse.redirect(`${origin}/login?error=${error}`);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return toLogin('not_configured');
  if (!code) return toLogin('auth_failed');

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return toLogin('auth_failed');

  const { data: allowed } = await supabase.rpc('is_allowed_user');
  if (allowed !== true) {
    await supabase.auth.signOut();
    return toLogin('forbidden');
  }

  return NextResponse.redirect(`${origin}${next}`);
}

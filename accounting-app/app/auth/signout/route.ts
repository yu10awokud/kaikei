import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// ============================================================
// ログアウト
//   POST：メニューの「ログアウト」ボタンから
//   GET ：許可されていない人を強制的にログアウトさせるとき（?error=forbidden）
// ============================================================
async function signOutAndRedirect(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();

  const error = request.nextUrl.searchParams.get('error');
  const url = new URL('/login', request.nextUrl.origin);
  if (error === 'forbidden') url.searchParams.set('error', 'forbidden');
  // 303：POST のあとでも GET で /login を開かせる
  return NextResponse.redirect(url, { status: 303 });
}

export const GET = signOutAndRedirect;
export const POST = signOutAndRedirect;

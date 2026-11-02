import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getPublicSupabaseEnv } from '@/lib/env';

// ============================================================
// すべてのリクエストの前に動く処理
//   1. ログインのクッキー（セッション）を更新する
//   2. 未ログインなら /login へ移動させる
//   ※ 「allowed_users に入っているか」の確認は (app)/layout.tsx と API 側で行う
// ============================================================

/** ログインしていなくても開けるパス */
const PUBLIC_PATHS = ['/login', '/auth/', '/api/cron/'];

export async function middleware(request: NextRequest) {
  const env = getPublicSupabaseEnv();
  // 環境変数が未設定のときは素通しし、画面側で設定方法を案内する
  if (!env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() は Supabase に問い合わせてトークンを検証する（getSession より安全）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p));

  if (!user && !isPublic) {
    // API には JSON で 401 を返す（画面遷移させない）
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'ログインしてください。' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    if (path !== '/') url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // 画像・静的ファイルには適用しない
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)'],
};

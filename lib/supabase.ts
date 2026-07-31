import { createClient } from "@supabase/supabase-js";

/**
 * Supabase クライアントの作り方は2種類あります。
 *
 * 1) createSupabaseClient()  … Server Component / Route Handler から呼ぶサーバー用
 * 2) createBrowserClient()   … 'use client' なコンポーネントから呼ぶブラウザ用
 *
 * このアプリでは「DB を触るのは基本サーバー側だけ」という方針にしています。
 * ブラウザからは fetch('/api/...') で自作の API を叩き、その中でサーバーが Supabase を触ります。
 * こうすると「編集モードの合言葉チェック」を必ずサーバーで通せるからです。
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 任意。設定されていればサーバー側の書き込みだけ強い権限で行う（README の「セキュリティを強化する」参照）。
// NEXT_PUBLIC_ が付いていないのでブラウザには絶対に渡りません。
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assertEnv(): { url: string; key: string } {
  if (!url || !anonKey) {
    throw new Error(
      "環境変数 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません。.env.local.example を参考に .env.local を作ってください。",
    );
  }
  return { url, key: anonKey };
}

/** サーバー側（Server Component・Route Handler）用のクライアント */
export function createSupabaseClient() {
  const env = assertEnv();
  return createClient(env.url, serviceRoleKey ?? env.key, {
    auth: {
      // ログイン機能を使わないので、セッションの保存・自動更新は全部オフにします。
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/** ブラウザ側用のクライアント（今のところ未使用だが、必要になったとき用に用意） */
export function createBrowserSupabaseClient() {
  const env = assertEnv();
  return createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

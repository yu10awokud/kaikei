'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getPublicSupabaseEnv } from '@/lib/env';

// ============================================================
// ブラウザ用の Supabase クライアント（Google ログインの開始に使う）
// ============================================================
export function createSupabaseBrowserClient() {
  const env = getPublicSupabaseEnv();
  if (!env) return null;
  return createBrowserClient(env.url, env.anonKey);
}

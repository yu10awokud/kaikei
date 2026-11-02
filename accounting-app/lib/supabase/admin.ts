import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPublicSupabaseEnv } from '@/lib/env';

// ============================================================
// 全権限（service_role）の Supabase クライアント
//   ★ RLS を素通りするので、使う場所を限定する：
//     ・スプレッドシートへの書き出し（第3段階）
//     ・夜間の定期処理（第6段階）
//   画面からの読み書きには使わないこと（createSupabaseServerClient を使う）。
// ============================================================
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached) return cached;
  const env = getPublicSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!env || !serviceKey) return null;
  cached = createClient(env.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

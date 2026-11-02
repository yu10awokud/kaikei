import { redirect } from 'next/navigation';
import Image from 'next/image';
import GoogleLoginButton from '@/components/auth/GoogleLoginButton';
import { getAuthState, safeNextPath } from '@/lib/auth';
import { ENV_MISSING_MESSAGE } from '@/lib/env';

// ============================================================
// ログイン画面
// ============================================================

const ERROR_MESSAGES: Record<string, string> = {
  forbidden:
    'このGoogleアカウントには利用許可がありません。会計担当に、allowed_users へのメールアドレス登録を依頼してください。',
  auth_failed: 'ログインに失敗しました。もう一度お試しください。',
  not_configured: ENV_MISSING_MESSAGE,
};

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const auth = await getAuthState();

  // すでに許可済みでログインしていればホームへ
  if (auth.status === 'ok') redirect(next);

  const errorKey = auth.status === 'not_configured' ? 'not_configured' : params.error;
  const message = errorKey ? ERROR_MESSAGES[errorKey] : null;

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4">
      <div className="card w-full max-w-sm p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/logo-kpum.png"
            alt="京都府立医科大学 水泳部"
            width={512}
            height={512}
            priority
            className="mb-3 h-16 w-16 object-contain"
          />
          <h1 className="text-lg font-bold text-ink">水泳部 会計管理システム</h1>
          <p className="font-en text-[10px] font-medium uppercase tracking-[0.16em] text-ink-faint">
            KPUM Swim Team Accounting
          </p>
        </div>

        {message && (
          <div role="alert" className="mb-5 rounded-xl bg-alert-soft px-4 py-3 text-[13px] leading-relaxed text-alert">
            {message}
          </div>
        )}

        {auth.status !== 'not_configured' && <GoogleLoginButton next={next} />}

        <p className="mt-5 text-center text-[12px] leading-relaxed text-ink-faint">
          利用を許可されたアカウントのみログインできます。
        </p>
      </div>
    </div>
  );
}

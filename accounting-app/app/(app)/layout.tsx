import { redirect } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import SetupNotice from '@/components/ui/SetupNotice';
import { getAuthState } from '@/lib/auth';

// ============================================================
// ログイン後の画面すべてに共通する外枠
//   allowed_users に入っていない人は、ここで強制ログアウトさせる。
// ============================================================
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthState();

  if (auth.status === 'not_configured') return <SetupNotice />;
  if (auth.status === 'signed_out') redirect('/login');
  if (auth.status === 'forbidden') redirect('/auth/signout?error=forbidden');

  return <AppShell email={auth.email}>{children}</AppShell>;
}

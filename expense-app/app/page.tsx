import AppTabs from '@/components/AppTabs';

// 練習予定は必ず最新を取りに行くので、ページはキャッシュしない
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return <AppTabs />;
}

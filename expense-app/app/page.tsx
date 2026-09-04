import PracticeList from '@/components/PracticeList';

// 練習予定は必ず最新を取りに行くので、ページはキャッシュしない
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return <PracticeList />;
}

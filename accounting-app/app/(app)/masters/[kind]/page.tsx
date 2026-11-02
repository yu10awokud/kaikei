import { notFound } from 'next/navigation';
import ComingSoon from '@/components/ui/ComingSoon';

const LABELS: Record<string, string> = {
  accounts: '口座',
  facilities: '施設',
  types: '種別',
  members: '部員',
  templates: 'テンプレート',
};

export default async function MasterKindPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const label = LABELS[kind];
  if (!label) notFound();
  return <ComingSoon title={`マスタ管理：${label}`} stage={5} items={['追加・編集・並び替え・無効化']} />;
}

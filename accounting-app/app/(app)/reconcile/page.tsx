import ComingSoon from '@/components/ui/ComingSoon';

export default function ReconcilePage() {
  return (
    <ComingSoon
      title="照合"
      stage={4}
      items={['月次の施設照合表（出席システムの引落合計を入力）', '現金・通帳照合（検算との差額表示）']}
    />
  );
}

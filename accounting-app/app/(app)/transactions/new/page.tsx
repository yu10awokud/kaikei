import ComingSoon from '@/components/ui/ComingSoon';

export default function NewTransactionPage() {
  return (
    <ComingSoon
      title="取引を入力"
      stage={2}
      items={['複数行を1グループとして登録', '会計間の振替（口座空欄）']}
    />
  );
}

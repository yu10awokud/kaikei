import ComingSoon from '@/components/ui/ComingSoon';

export default function TransactionsPage() {
  return (
    <ComingSoon
      title="取引一覧"
      stage={2}
      items={['会計区分・対象月・口座・種別・施設で絞り込み', '取消・再登録', '確認済みチェック']}
    />
  );
}

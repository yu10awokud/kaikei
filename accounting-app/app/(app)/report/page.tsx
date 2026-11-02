import ComingSoon from '@/components/ui/ComingSoon';

export default function ReportPage() {
  return (
    <ComingSoon
      title="締めレポート"
      stage={6}
      items={['指定日時点の各会計残高・口座残高・立替残高', '未払いプール代・直近の照合結果', 'プレーンテキスト出力とコピーボタン']}
    />
  );
}

// ============================================================
// リンク集
//   ここに 1 件ずつ足すだけで、トップページのリンク集に増えます。
// ============================================================

export type SiteLink = {
  title: string;
  url: string;
  description: string;
};

export const LINKS: SiteLink[] = [
  {
    title: '部活動ホームページ',
    url: 'https://example.com/',
    description: '大会日程・お知らせはこちら（※ダミーURLです。差し替えてください）',
  },
  {
    title: '練習日程スプレッドシート',
    url: 'https://example.com/schedule',
    description: '月間の練習予定とプール割り当て（※ダミーURL）',
  },
  {
    title: '大会エントリーフォーム',
    url: 'https://example.com/entry',
    description: '出場申し込みはこのフォームから（※ダミーURL）',
  },
];

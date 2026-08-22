// ============================================================
// Excel テンプレートのバージョン履歴
//   配列の「先頭が最新」。新しい版を出したら先頭に 1 件足すだけ。
//   ファイル本体は public/templates/ に置く。
// ============================================================

export type TemplateVersion = {
  /** public/templates/ の中のファイル名 */
  fileName: string;
  /** 表示用のファイルサイズ（例 '20.3 KB'） */
  size: string;
  /** 更新日（'25.09.20' 形式） */
  date: string;
  /** バージョン（'Ver.8.3' 形式） */
  version: string;
  /** 変更内容の要約 */
  note: string;
};

export const TEMPLATE_VERSIONS: TemplateVersion[] = [
  {
    fileName: 'kpumswim_template.xlsx',
    size: '20.3 KB',
    date: '25.09.20',
    version: 'Ver.8.3',
    note: 'マネ欄に記号Ⓗを追加',
  },
  {
    fileName: 'kpumswim_template.xlsx',
    size: '20.1 KB',
    date: '25.06.02',
    version: 'Ver.8.2',
    note: '距離の合計欄を自動計算に変更',
  },
  {
    fileName: 'kpumswim_template.xlsx',
    size: '19.8 KB',
    date: '25.04.10',
    version: 'Ver.8.1',
    note: '印刷範囲をA4横1ページに調整',
  },
];

/** 最新版（メイン表示に使う） */
export const LATEST_TEMPLATE = TEMPLATE_VERSIONS[0];

/** 過去版（更新履歴に使う） */
export const PAST_TEMPLATES = TEMPLATE_VERSIONS.slice(1);

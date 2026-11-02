// ============================================================
// サイトのメニュー構成とパンくずリストの表示名
//   ハンバーガーメニュー・パンくずの両方がここを参照する。
// ============================================================

export type NavItem = {
  href: string;
  label: string;
  /** メニューに出す小さな説明 */
  hint?: string;
  children?: NavItem[];
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'ホーム', hint: '残高・よく使う会計処理' },
  { href: '/transactions/new', label: '取引を入力', hint: '複数行・振替もここから' },
  { href: '/transactions', label: '取引一覧', hint: '絞り込み・取消・確認済み' },
  { href: '/reconcile', label: '照合', hint: '施設照合・現金/通帳照合' },
  { href: '/report', label: '締めレポート', hint: '引き継ぎ用テキスト' },
  {
    href: '/masters',
    label: 'マスタ管理',
    hint: '口座・施設・種別・部員・テンプレート',
    children: [
      { href: '/masters/accounts', label: '口座' },
      { href: '/masters/facilities', label: '施設' },
      { href: '/masters/types', label: '種別' },
      { href: '/masters/members', label: '部員' },
      { href: '/masters/templates', label: 'テンプレート' },
    ],
  },
];

/** パス 1 区切りごとの表示名（動的な部分は呼び出し側で上書きする） */
const SEGMENT_LABELS: Record<string, string> = {
  transactions: '取引一覧',
  new: '取引を入力',
  reconcile: '照合',
  report: '締めレポート',
  masters: 'マスタ管理',
  accounts: '口座',
  facilities: '施設',
  types: '種別',
  members: '部員',
  templates: 'テンプレート',
  run: 'テンプレート入力',
};

export type Crumb = { href: string; label: string };

/** '/transactions/new' → [ホーム, 取引一覧, 取引を入力] */
export function buildCrumbs(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ href: '/', label: 'ホーム' }];
  const segments = pathname.split('/').filter(Boolean);
  let href = '';
  for (const segment of segments) {
    href += `/${segment}`;
    const label = SEGMENT_LABELS[segment] ?? decodeURIComponent(segment);
    crumbs.push({ href, label });
  }
  return crumbs;
}

/** そのメニュー項目が今のページ（またはその配下）か */
export function isActive(itemHref: string, pathname: string): boolean {
  if (itemHref === '/') return pathname === '/';
  // 「取引一覧」は「取引を入力」(/transactions/new) では光らせない
  if (itemHref === '/transactions') {
    return pathname === '/transactions' || (pathname.startsWith('/transactions/') && !pathname.startsWith('/transactions/new'));
  }
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}

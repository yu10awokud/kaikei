import Link from 'next/link';
import { NAV_ITEMS } from '@/lib/nav';

export default function MastersPage() {
  const children = NAV_ITEMS.find((item) => item.href === '/masters')?.children ?? [];
  return (
    <section>
      <h1 className="mb-4 text-lg font-bold text-ink">マスタ管理</h1>
      <p className="mb-4 text-[13px] text-ink-faint">編集機能は第5段階で実装します。現在はホーム画面で登録内容を確認できます。</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {children.map((child) => (
          <li key={child.href}>
            <Link href={child.href} className="card block px-4 py-3 text-[14px] font-bold text-ink tap">
              {child.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { buildCrumbs } from '@/lib/nav';

// ============================================================
// パンくずリスト（ホーム ＞ 取引一覧 ＞ 取引を入力）
//   ホーム画面では出さない。最後の項目は今いるページなのでリンクにしない。
// ============================================================
export default function Breadcrumbs() {
  const pathname = usePathname();
  if (pathname === '/') return null;

  const crumbs = buildCrumbs(pathname);
  return (
    <nav aria-label="パンくずリスト" className="mb-4 overflow-x-auto">
      <ol className="flex items-center gap-1 whitespace-nowrap text-[12px] text-ink-faint">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden="true">›</span>}
              {last ? (
                <span aria-current="page" className="font-bold text-ink-soft">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="hover:text-aqua-600 hover:underline">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

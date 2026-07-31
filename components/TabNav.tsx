"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 共通タブ。
 * 「今どのページにいるか」で見た目を変えたいので usePathname() を使います。
 * これはブラウザ側のフックなので 'use client' が必要です。
 *
 * ページ遷移には <a> ではなく next/link の <Link> を使います。
 * ページ全体を再読み込みせず、必要な部分だけ差し替えてくれるので速いです。
 */

const TABS = [
  { href: "/", label: "TOP" },
  { href: "/tasks", label: "タスク" },
  { href: "/pools", label: "プールマスタ" },
  { href: "/calendar", label: "カレンダー" },
];

export function TabNav() {
  const pathname = usePathname();

  return (
    <nav className="no-print flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const active =
          tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              "whitespace-nowrap rounded-t-md px-4 py-2 text-sm font-medium transition",
              active
                ? "bg-slate-50 text-sky-700"
                : "text-white/80 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

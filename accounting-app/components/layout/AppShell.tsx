'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { NAV_ITEMS, isActive } from '@/lib/nav';

// ============================================================
// 画面の外枠：ヘッダー（ロゴ＋ハンバーガーメニュー）＋パンくず＋本文
//   ・ハンバーガーを押すと右からメニューが出る（Esc／背景タップで閉じる）
//   ・PC 幅では上部に主要メニューも並べる
// ============================================================
export default function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // ページを移動したらメニューを閉じる
  useEffect(() => setOpen(false), [pathname]);

  // メニューが開いている間：Esc で閉じる・背景のスクロールを止める・閉じるボタンにフォーカス
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-4 sm:px-6">
      <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <Image
              src="/logo-kpum.png"
              alt=""
              width={512}
              height={512}
              priority
              className="h-9 w-9 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold leading-snug text-ink">水泳部 会計管理</p>
              <p className="font-en text-[9px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                KPUM Swim Accounting
              </p>
            </div>
          </Link>

          {/* PC 幅：主要メニューを横並びで表示 */}
          <nav aria-label="主要メニュー" className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.slice(1).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  isActive(item.href, pathname)
                    ? 'bg-aqua-50 text-aqua-700'
                    : 'text-ink-soft hover:bg-line-soft'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* ハンバーガーボタン */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="メニューを開く"
            aria-expanded={open}
            aria-controls="site-drawer"
            className="flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-[5px] rounded-full border border-line tap"
          >
            <span className="block h-[2px] w-[18px] rounded bg-ink" />
            <span className="block h-[2px] w-[18px] rounded bg-ink" />
            <span className="block h-[2px] w-[18px] rounded bg-ink" />
          </button>
        </div>
      </header>

      {/* ドロワーメニュー */}
      <div
        className={`fixed inset-0 z-40 bg-ink/30 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <aside
        id="site-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="サイトメニュー"
        aria-hidden={!open}
        inert={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-[300px] max-w-[85vw] flex-col bg-white transition-transform duration-200 ${
          open ? 'translate-x-0 shadow-xl' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="font-en text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Menu</p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="メニューを閉じる"
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-ink-soft tap"
          >
            ×
          </button>
        </div>

        <nav aria-label="サイトメニュー" className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-xl px-3 py-2.5 ${
                    isActive(item.href, pathname) ? 'bg-aqua-50' : 'hover:bg-line-soft'
                  }`}
                >
                  <span
                    className={`block text-[14px] font-bold ${
                      isActive(item.href, pathname) ? 'text-aqua-700' : 'text-ink'
                    }`}
                  >
                    {item.label}
                  </span>
                  {item.hint && <span className="block text-[11px] text-ink-faint">{item.hint}</span>}
                </Link>
                {item.children && (
                  <ul className="mb-1 ml-4 mt-0.5 border-l border-line pl-2">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className={`block rounded-lg px-3 py-1.5 text-[13px] ${
                            pathname === child.href
                              ? 'font-bold text-aqua-700'
                              : 'text-ink-soft hover:bg-line-soft'
                          }`}
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-line px-5 py-4">
          <p className="mb-2 truncate text-[12px] text-ink-faint" title={email}>
            {email}
          </p>
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn w-full">
              ログアウト
            </button>
          </form>
        </div>
      </aside>

      <Breadcrumbs />
      <main>{children}</main>
    </div>
  );
}

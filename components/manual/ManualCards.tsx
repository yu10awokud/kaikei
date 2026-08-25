import Link from 'next/link';
import SectionHeader from '@/components/SectionHeader';
import { MANUAL_META, MANUAL_SLUGS } from '@/lib/markdown';

// ② マニュアル：3 枚のカードを並べる（スマホ 1 列 / PC 3 列）
export default function ManualCards() {
  return (
    <section id="manual">
      <SectionHeader title="マニュアル" en="Manual" />

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {MANUAL_SLUGS.map((slug) => {
          const meta = MANUAL_META[slug];
          return (
            <Link
              key={slug}
              href={`/manual/${slug}`}
              className="card flex items-center gap-3 p-4 tap sm:flex-col sm:items-start sm:gap-0"
            >
              {/* 絵文字は使わず、番号を小さく添える */}
              <span
                className="font-en flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-ink-soft sm:mb-3"
                style={{ backgroundColor: meta.tint }}
              >
                {meta.icon}
              </span>

              <span className="min-w-0">
                <span className="font-en block text-sm font-semibold lowercase tracking-wide text-ink">
                  {meta.title}
                </span>
                <span className="mt-0.5 block text-[11px] text-ink-faint">{meta.subtitle}</span>
              </span>

              <span aria-hidden className="ml-auto text-ink-faint sm:hidden">
                ›
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

import Link from 'next/link';
import SectionHeader from '@/components/SectionHeader';
import { MANUAL_META, MANUAL_SLUGS } from '@/lib/markdown';

// ② マニュアル：3 枚のカードをグリッド表示（スマホ 2 列 / PC 3 列）
export default function ManualCards() {
  return (
    <section id="manual">
      <SectionHeader emoji="📚" title="マニュアル" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {MANUAL_SLUGS.map((slug) => {
          const meta = MANUAL_META[slug];
          return (
            <Link
              key={slug}
              href={`/manual/${slug}`}
              className="card overflow-hidden tap"
            >
              {/* 上部：CSS グラデーションのカバー領域 */}
              <div className="h-20 w-full sm:h-24" style={{ background: meta.gradient }} />
              {/* 下部：アイコンとタイトル */}
              <div className="px-3 py-2.5">
                <div className="text-lg leading-none">{meta.icon}</div>
                <div className="mt-1 text-sm font-bold">{meta.title}</div>
                <div className="text-xs text-neutral-500">{meta.subtitle}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

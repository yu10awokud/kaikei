import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  MANUAL_META, MANUAL_SLUGS, isManualSlug, markdownToHtml, readManualMarkdown,
} from '@/lib/markdown';

// 3 枚のカードに対応する個別ページ（本文は content/*.md をビルド時に読み込む）
export function generateStaticParams() {
  return MANUAL_SLUGS.map((slug) => ({ slug }));
}

export default async function ManualPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isManualSlug(slug)) notFound();

  const meta = MANUAL_META[slug];
  const html = markdownToHtml(readManualMarkdown(slug));

  return (
    <main>
      <Link href="/" className="text-sm text-neutral-500 underline">
        ← トップに戻る
      </Link>

      <div className="mt-4 overflow-hidden rounded-card border border-line">
        <div className="h-24 w-full sm:h-32" style={{ background: meta.gradient }} />
        <div className="px-4 py-3">
          <div className="text-xl leading-none">{meta.icon}</div>
          <h1 className="mt-1.5 text-xl font-bold">{meta.title}</h1>
          <p className="text-xs text-neutral-500">{meta.subtitle}</p>
        </div>
      </div>

      <article className="mt-6 text-sm" dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}

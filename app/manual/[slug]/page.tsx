import Link from 'next/link';
import { notFound } from 'next/navigation';
import MenuArchive from '@/components/archive/MenuArchive';
import {
  MANUAL_META, MANUAL_SLUGS, isManualSlug, markdownToHtml, readManualMarkdown,
} from '@/lib/markdown';
import { fetchArchiveData } from '@/lib/queries';

// 3 枚のカードに対応する個別ページ
//   usage / tips は content/*.md の本文を表示する
//   archive はアップロード済みのメニューPDF一覧を表示する（常に最新を出す）
export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return MANUAL_SLUGS.map((slug) => ({ slug }));
}

export default async function ManualPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isManualSlug(slug)) notFound();

  const meta = MANUAL_META[slug];
  const html = markdownToHtml(readManualMarkdown(slug));
  const archive = slug === 'archive' ? await fetchArchiveData() : null;

  return (
    <main>
      <Link
        href="/"
        className="text-[13px] font-medium text-ink-faint underline underline-offset-2"
      >
        ← トップに戻る
      </Link>

      <div className="mt-5 flex items-center gap-3 border-b border-line pb-5">
        <span
          className="font-en flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-ink-soft"
          style={{ backgroundColor: meta.tint }}
        >
          {meta.icon}
        </span>
        <div>
          <h1 className="font-en text-2xl font-semibold lowercase tracking-tight text-ink">
            {meta.title}
          </h1>
          <p className="text-xs text-ink-faint">{meta.subtitle}</p>
        </div>
      </div>

      {archive ? (
        <div className="mt-6">
          {html && (
            <article className="mb-6 text-sm" dangerouslySetInnerHTML={{ __html: html }} />
          )}
          <MenuArchive
            files={archive.files}
            assignments={archive.assignments}
            members={archive.members}
            places={archive.places}
          />
        </div>
      ) : (
        <article className="mt-6 text-sm" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </main>
  );
}

import SectionHeader from '@/components/SectionHeader';
import { LATEST_TEMPLATE } from '@/data/template';

// ① テンプレート：Excel ファイルをそのままダウンロードさせる
export default function TemplateSection() {
  return (
    <section id="template">
      <SectionHeader title="テンプレート" en="Template" />

      <a
        href={`/templates/${LATEST_TEMPLATE.fileName}`}
        download
        className="card flex items-center justify-between gap-3 p-4 tap"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-ink">
            {LATEST_TEMPLATE.fileName}
          </span>
          <span className="font-en mt-0.5 block text-[11px] font-medium text-ink-faint">
            {LATEST_TEMPLATE.size}　·　{LATEST_TEMPLATE.date}　·　{LATEST_TEMPLATE.version}
          </span>
          <span className="mt-1 block text-[11px] text-ink-soft">{LATEST_TEMPLATE.note}</span>
        </span>

        <span className="shrink-0 rounded-full bg-aqua-600 px-4 py-2 text-xs font-bold text-white">
          ダウンロード
        </span>
      </a>
    </section>
  );
}

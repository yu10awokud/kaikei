import SectionHeader from '@/components/SectionHeader';
import { LATEST_TEMPLATE, PAST_TEMPLATES } from '@/data/template';

// ① テンプレート：Excel ファイルをそのままダウンロードさせる
export default function TemplateSection() {
  return (
    <section id="template">
      <SectionHeader emoji="📄" title="テンプレート" />

      <div className="card p-4">
        <a
          href={`/templates/${LATEST_TEMPLATE.fileName}`}
          download
          className="flex items-center justify-between gap-3 rounded-card border border-line px-3 py-3 tap"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{LATEST_TEMPLATE.fileName}</span>
            <span className="block text-xs text-neutral-500">{LATEST_TEMPLATE.size}</span>
          </span>
          <span className="shrink-0 rounded-card bg-ink px-3 py-1.5 text-xs font-bold text-white">
            ダウンロード
          </span>
        </a>

        <p className="mt-3 text-xs text-neutral-600">
          {LATEST_TEMPLATE.date}　｜　{LATEST_TEMPLATE.version}　｜　{LATEST_TEMPLATE.note}
        </p>

        {PAST_TEMPLATES.length > 0 && (
          <details className="mt-3 border-t border-line pt-3">
            <summary className="cursor-pointer text-xs text-neutral-500">更新履歴を見る</summary>
            <ul className="mt-2 space-y-1.5">
              {PAST_TEMPLATES.map((t) => (
                <li key={`${t.version}-${t.date}`} className="text-xs text-neutral-600">
                  {t.date}　｜　{t.version}　｜　{t.note}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}

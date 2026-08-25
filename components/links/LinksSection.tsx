import SectionHeader from '@/components/SectionHeader';
import { LINKS } from '@/data/links';

// ④ リンク集：外部リンクは新しいタブで開く（PC は 2 列 / スマホは 1 列）
export default function LinksSection() {
  return (
    <section id="links">
      <SectionHeader title="リンク集" en="Links" />

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {LINKS.map((link) => (
          <li key={link.url}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card flex items-center justify-between gap-3 px-3.5 py-3 tap"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-bold text-ink">{link.title}</span>
                <span className="font-en mt-0.5 block truncate text-[11px] text-ink-faint">
                  {link.description}
                </span>
              </span>
              <span aria-hidden className="shrink-0 text-xs text-ink-faint">
                ↗
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

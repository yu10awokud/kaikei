import fs from 'node:fs';
import path from 'node:path';

// ============================================================
// content/*.md をビルド時（サーバー側）に読み込む
//   外部ライブラリを使わない最小限の Markdown → HTML 変換。
//   見出し / 箇条書き / 番号つき / 太字 / リンク / 段落に対応。
// ============================================================

export const MANUAL_SLUGS = ['usage', 'tips', 'archive'] as const;
export type ManualSlug = (typeof MANUAL_SLUGS)[number];

export const MANUAL_META: Record<
  ManualSlug,
  { title: string; subtitle: string; icon: string; gradient: string }
> = {
  usage: {
    title: 'usage',
    subtitle: '使い方',
    icon: '📘',
    // 赤系
    gradient: 'linear-gradient(135deg, #E4572E 0%, #F2A08C 100%)',
  },
  tips: {
    title: 'tips',
    subtitle: 'コツ・小技',
    icon: '💡',
    // 青緑系
    gradient: 'linear-gradient(135deg, #17796F 0%, #7FD8CB 100%)',
  },
  archive: {
    title: 'archive',
    subtitle: '過去の資料',
    icon: '🗂️',
    // 薄いオレンジ系
    gradient: 'linear-gradient(135deg, #F5C77E 0%, #FDF0D5 100%)',
  },
};

export function isManualSlug(value: string): value is ManualSlug {
  return (MANUAL_SLUGS as readonly string[]).includes(value);
}

/** content/<slug>.md を読む。無ければ空文字。 */
export function readManualMarkdown(slug: ManualSlug): string {
  const file = path.join(process.cwd(), 'content', `${slug}.md`);
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

/** 最小限の Markdown → HTML 変換 */
export function markdownToHtml(md: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const inline = (s: string) =>
    escape(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code class="rounded bg-cream px-1 py-0.5 text-[0.9em]">$1</code>')
      .replace(
        /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-700 underline">$1</a>'
      );

  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const size = ['text-xl', 'text-lg', 'text-base', 'text-base'][level - 1];
      out.push(`<h${level} class="mt-6 mb-2 font-bold ${size}">${inline(heading[2])}</h${level}>`);
      continue;
    }

    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) {
      if (list !== 'ul') {
        closeList();
        out.push('<ul class="my-2 list-disc space-y-1 pl-5">');
        list = 'ul';
      }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      if (list !== 'ol') {
        closeList();
        out.push('<ol class="my-2 list-decimal space-y-1 pl-5">');
        list = 'ol';
      }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    if (/^(-{3,}|_{3,})$/.test(line)) {
      closeList();
      out.push('<hr class="my-6 border-line" />');
      continue;
    }

    closeList();
    out.push(`<p class="my-2 leading-7">${inline(line)}</p>`);
  }

  closeList();
  return out.join('\n');
}

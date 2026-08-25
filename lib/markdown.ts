import fs from 'node:fs';
import path from 'node:path';

// ============================================================
// content/*.md をビルド時（サーバー側）に読み込む
//   外部ライブラリを使わない Markdown → HTML 変換。
//   Notion のページに近い見た目を出すため、
//   通常の Markdown 記法に加えて次の独自記法に対応する：
//
//   ・帯付き見出し（Notion の色帯タイトル）      # 見出し文
//   ・赤字強調                                    {red}テキスト{/red}
//   ・折りたたみ（トグル）                        ::: toggle 見出し
//                                                  中身…
//                                                  :::
//   ・注釈ボックス（灰色の枠）                    ::: note タイトル（絵文字は好きに含めてOK）
//                                                  中身…
//                                                  :::
//   ・引用／補足ブロック（左に縦線）              > テキスト
//   ・画像                                        ![説明](/manual/xxx.png)
//   ・表組み（スマホでは横スクロール）           | 見出し | 見出し |
//                                                  | --- | --- |
//                                                  | 値 | 値 |
//   ・ファイルのダウンロードボタン                !file[表示名](/templates/xxx.xlsx)
//   ・サイト内リンク（別ページへ）                [表示名](/path#anchor)
// ============================================================

export const MANUAL_SLUGS = ['usage', 'tips', 'archive'] as const;
export type ManualSlug = (typeof MANUAL_SLUGS)[number];

export const MANUAL_META: Record<
  ManualSlug,
  { title: string; subtitle: string; icon: string; tint: string }
> = {
  usage: {
    title: 'usage',
    subtitle: '使い方',
    icon: '01', // 絵文字は使わず、番号で示す
    tint: '#DDEDF8', // 薄いブルー
  },
  tips: {
    title: 'tips',
    subtitle: 'コツ・小技',
    icon: '02',
    tint: '#DFF1EC', // 薄い青緑
  },
  archive: {
    title: 'archive',
    subtitle: '過去の資料',
    icon: '03',
    tint: '#F0EEE9', // 薄いグレージュ
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

// ------------------------------------------------------------
// インライン記法（太字・赤字強調・コード・リンク）
// ------------------------------------------------------------
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 見出しの文字列から、ジャンプ先に使う id を作る。
 *   例：「0. メニュー担当」→「0-メニュー担当」
 *   目次のリンク（[0. メニュー担当](#0-メニュー担当)）と対応させて使う。
 */
export function slugify(text: string): string {
  return text
    .trim()
    .replace(/[.:：、，,！？!?「」『』（）()\[\]［］]/g, '')
    .replace(/\s+/g, '-');
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(
      /\{red\}(.+?)\{\/red\}/g,
      '<strong class="text-rose-600">$1</strong>'
    )
    .replace(/`(.+?)`/g, '<code class="rounded bg-line-soft px-1 py-0.5 text-[0.9em]">$1</code>')
    // 同じページ内の見出しへのジャンプリンク（#で始まる）
    .replace(
      /\[(.+?)\]\((#[^\s)]+)\)/g,
      '<a href="$2" class="text-aqua-600 underline underline-offset-2">$1</a>'
    )
    // サイト内の別ページへのリンク（/ で始まる。例：/#duty）
    .replace(
      /\[(.+?)\]\((\/[^\s)]+)\)/g,
      '<a href="$2" class="text-aqua-600 underline underline-offset-2">$1</a>'
    )
    // 外部リンクは新しいタブで開く
    .replace(
      /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-aqua-600 underline underline-offset-2">$1</a>'
    );
}

/** 行の配列を HTML に変換する（トグル・注釈ボックスの中身にも再帰的に使う） */
function parseLines(lines: string[]): string {
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let quote: string[] | null = null;

  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };

  const closeQuote = () => {
    if (quote) {
      out.push(
        `<div class="my-6 border-l-[3px] border-line bg-line-soft/60 py-3.5 pl-5 pr-3 text-[15px] text-ink-soft">${quote
          .map((q) => `<p class="leading-6">${inline(q)}</p>`)
          .join('')}</div>`
      );
      quote = null;
    }
  };

  const closeBlocks = () => {
    closeList();
    closeQuote();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();

    // ::: toggle 見出し … ::: 折りたたみブロック
    const toggleStart = line.match(/^:::\s*toggle\s+(.*)$/);
    if (toggleStart) {
      closeBlocks();
      const inner: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ':::') {
        inner.push(lines[i]);
        i++;
      }
      out.push(
        `<details class="my-6 rounded-card border border-line bg-line-soft/60 px-4 py-3">` +
          `<summary class="cursor-pointer text-sm font-bold">${inline(toggleStart[1])}</summary>` +
          `<div class="mt-2 border-t border-line pt-2">${parseLines(inner)}</div>` +
          `</details>`
      );
      continue;
    }

    // ::: note タイトル … ::: 注釈ボックス（📌）
    const noteStart = line.match(/^:::\s*note\s*(.*)$/);
    if (noteStart) {
      closeBlocks();
      const inner: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ':::') {
        inner.push(lines[i]);
        i++;
      }
      out.push(
        `<div class="my-6 rounded-card border border-line bg-line-soft/60 px-4 py-3.5">` +
          (noteStart[1]
            ? `<div class="mb-1 flex items-center gap-1.5 text-sm font-bold">${inline(noteStart[1])}</div>`
            : '') +
          `<div class="text-sm">${parseLines(inner)}</div>` +
          `</div>`
      );
      continue;
    }

    if (!line.trim()) {
      closeBlocks();
      continue;
    }

    // 見出し（# は Notion の色帯タイトルとして表示）
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeBlocks();
      const level = heading[1].length;
      const id = slugify(heading[2]);
      if (level === 1) {
        out.push(
          `<h1 id="${id}" class="scroll-mt-4 rounded-card bg-aqua-50 px-5 py-4 text-2xl font-bold sm:text-3xl mt-16 mb-5 first:mt-0">${inline(heading[2])}</h1>`
        );
      } else if (level === 2) {
        out.push(
          `<h2 id="${id}" class="scroll-mt-4 mt-11 mb-3.5 text-xl font-bold underline decoration-[3px] underline-offset-[6px] sm:text-2xl">${inline(heading[2])}</h2>`
        );
      } else {
        const size = level === 3 ? 'text-lg' : 'text-base';
        out.push(
          `<h${level} id="${id}" class="scroll-mt-4 mt-7 mb-2.5 font-bold ${size}">${inline(heading[2])}</h${level}>`
        );
      }
      continue;
    }

    // 引用／補足（縦線つきブロック）
    const quoteLine = line.match(/^>\s?(.*)$/);
    if (quoteLine) {
      closeList();
      quote = quote ?? [];
      quote.push(quoteLine[1]);
      continue;
    }

    // 画像
    const image = line.match(/^!\[(.*?)\]\((\S+)\)$/);
    if (image) {
      closeBlocks();
      out.push(
        `<img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}" loading="lazy" class="my-4 mx-auto block max-h-[75vh] w-auto max-w-full rounded-card border border-line" />`
      );
      continue;
    }

    // 表組み（1 行目が見出し、2 行目が |---|---| の区切り）
    //   スマホでは横スクロールできるようにする
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        if (!t.startsWith('|') || !t.endsWith('|')) break;
        tableLines.push(t);
        i++;
      }
      i--; // for 文の i++ と相殺する
      closeBlocks();

      const toCells = (row: string) =>
        row.slice(1, -1).split('|').map((cell) => cell.trim());

      const isSeparator = (row: string) => /^\|[\s:|-]+\|$/.test(row);

      const header = toCells(tableLines[0]);
      const bodyRows = tableLines
        .slice(isSeparator(tableLines[1] ?? '') ? 2 : 1)
        .map(toCells);

      out.push(
        '<div class="my-6 overflow-x-auto">' +
          '<table class="w-full min-w-[520px] border-collapse text-[15px]">' +
          '<thead><tr>' +
          header
            .map(
              (cell) =>
                `<th class="border border-line bg-line-soft px-3 py-2 text-left font-bold whitespace-nowrap">${inline(cell)}</th>`
            )
            .join('') +
          '</tr></thead><tbody>' +
          bodyRows
            .map(
              (row) =>
                '<tr>' +
                row
                  .map(
                    (cell) =>
                      `<td class="border border-line px-3 py-2 align-top whitespace-nowrap">${inline(cell)}</td>`
                  )
                  .join('') +
                '</tr>'
            )
            .join('') +
          '</tbody></table></div>'
      );
      continue;
    }

    // ファイルのダウンロードボタン　　!file[表示名](/templates/xxx.xlsx)
    const file = line.match(/^!file\[(.*?)\]\((\S+)\)$/);
    if (file) {
      closeBlocks();
      out.push(
        `<a href="${escapeHtml(file[2])}" download class="tap my-3 flex items-center justify-between gap-3 rounded-card border border-line bg-emerald-50 px-3 py-3 text-sm font-bold">` +
          `<span>${inline(file[1])}</span>` +
          `<span class="shrink-0 rounded-card bg-ink px-3 py-1.5 text-xs font-bold text-white">ダウンロード</span>` +
          `</a>`
      );
      continue;
    }

    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) {
      closeQuote();
      if (list !== 'ul') {
        closeList();
        out.push('<ul class="my-3.5 list-disc space-y-2.5 pl-6 text-[17px] leading-8">');
        list = 'ul';
      }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      closeQuote();
      if (list !== 'ol') {
        closeList();
        out.push('<ol class="my-3.5 list-decimal space-y-2.5 pl-6 text-[17px] leading-8">');
        list = 'ol';
      }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    if (/^(-{3,}|_{3,})$/.test(line)) {
      closeBlocks();
      out.push('<hr class="my-8 border-line" />');
      continue;
    }

    closeBlocks();
    out.push(`<p class="my-3.5 text-[17px] leading-8">${inline(line)}</p>`);
  }

  closeBlocks();
  return out.join('\n');
}

/** Markdown（＋独自記法）→ HTML 変換 */
export function markdownToHtml(md: string): string {
  return parseLines(md.split(/\r?\n/));
}

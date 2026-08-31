import type { Notice } from '@/lib/types';

// ============================================================
// お知らせ（トップページのタブの下に横長で出す）
//   主役は「次回の練習」なので、こちらは控えめな見た目にする。
//   ・淡いグレーの面に細い罫線、文字は小さめ
//   ・青は使わず、色で主張しない
// ============================================================
export default function NoticeBar({ notices }: { notices: Notice[] }) {
  if (notices.length === 0) return null;

  return (
    <div className="rounded-card border border-line bg-line-soft/60 px-4 py-3">
      <div className="font-en mb-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-faint">
        Notice
      </div>

      <ul className="space-y-1.5">
        {notices.map((n) => (
          <li key={n.id} className="flex gap-2 text-[13px] leading-relaxed text-ink-soft">
            <span aria-hidden className="select-none text-ink-faint">
              -
            </span>
            {/* 改行をそのまま活かす */}
            <span className="min-w-0 whitespace-pre-wrap">{n.body}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

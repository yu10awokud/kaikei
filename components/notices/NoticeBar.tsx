import type { Notice } from '@/lib/types';

// ============================================================
// お知らせ（トップページのタブの下に横長で出す）
//   主役は「次回の練習」なので大きくはしないが、
//   左端に色のラインを入れて“お知らせがある”ことは分かるようにする。
//   ・薄いブルーの面＋左に濃いブルーのライン
//   ・文字サイズは小さめのまま、色は本文と同じ濃さにして読みやすく
// ============================================================
export default function NoticeBar({ notices }: { notices: Notice[] }) {
  if (notices.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-card border border-aqua-100 bg-aqua-50/70">
      <div className="border-l-[3px] border-aqua-500 px-4 py-3">
        <div className="mb-1.5 flex items-baseline gap-2">
          <span className="text-[12px] font-bold tracking-wide text-aqua-700">お知らせ</span>
          <span className="font-en text-[10px] font-medium uppercase tracking-[0.16em] text-aqua-600/70">
            Notice
          </span>
        </div>

        <ul className="space-y-1.5">
          {notices.map((n) => (
            // 改行はそのまま活かす
            <li key={n.id} className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
              {n.body}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

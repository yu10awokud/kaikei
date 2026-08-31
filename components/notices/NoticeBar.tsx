import type { Notice } from '@/lib/types';

// ============================================================
// お知らせ（トップページのタブの下に横長で出す）
//   ・1 件ごとに独立したカードにする（複数あっても内容が混ざらない）
//   ・主役は「次回の練習」なので、文字は小さめのまま
//   ・薄いブルーの面＋左端の濃いブルーのラインで、あることは分かるようにする
// ============================================================
export default function NoticeBar({ notices }: { notices: Notice[] }) {
  if (notices.length === 0) return null;

  return (
    <div className="space-y-2">
      {notices.map((n, i) => (
        <div
          key={n.id}
          className="overflow-hidden rounded-card border border-aqua-100 bg-aqua-50/70"
        >
          <div className="border-l-[3px] border-aqua-500 px-4 py-3">
            {/* 見出しは 1 件目だけに付けて、並んだときにうるさくならないようにする */}
            {i === 0 && (
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className="text-[12px] font-bold tracking-wide text-aqua-700">お知らせ</span>
                <span className="font-en text-[10px] font-medium uppercase tracking-[0.16em] text-aqua-600/70">
                  Notice
                </span>
              </div>
            )}

            {/* 改行はそのまま活かす */}
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{n.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

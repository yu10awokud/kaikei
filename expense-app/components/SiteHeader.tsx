import Image from 'next/image';

// ============================================================
// サイト共通のヘッダー（ロゴ＋アプリ名）
//   ロゴは既存サイトと同じ京府医水泳部のものを使う。
// ============================================================
export default function SiteHeader() {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/logo-kpum.png"
        alt="京都府立医科大学 水泳部"
        width={512}
        height={512}
        priority
        className="h-11 w-11 shrink-0 object-contain"
      />
      <div className="min-w-0">
        <p className="text-[13px] font-bold leading-snug tracking-tight text-ink">
          京府医水泳部会計 領収書保存クラウド
        </p>
        <p className="font-en text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint">
          KPUM Swim Team Receipt Cloud
        </p>
      </div>
    </div>
  );
}

import Image from 'next/image';

// サイト共通のヘッダー（ロゴ＋タイトル）
export default function SiteHeader() {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/logo-kpum.svg"
        alt="京都府立医科大学 水泳部"
        width={40}
        height={40}
        priority
        className="h-10 w-10 shrink-0 rounded-[10px]"
      />
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-[22px]">メニュー特戦隊</h1>
        <p className="font-en text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint">
          KPUM Swim Team Menu Page
        </p>
      </div>
    </div>
  );
}

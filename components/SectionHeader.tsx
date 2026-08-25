// セクション見出し（帯はやめ、細い罫線と余白で区切る）
export default function SectionHeader({
  title,
  description,
  en,
}: {
  title: string;
  description?: string;
  /** 見出しの下に小さく出す英字ラベル（任意） */
  en?: string;
}) {
  return (
    <div className="mb-3.5 border-b border-line pb-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {en ? (
          <span className="font-en text-[10px] font-medium uppercase tracking-[0.16em] text-ink-faint">
            {en}
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="mt-1 text-xs leading-relaxed text-ink-faint">{description}</p>
      ) : null}
    </div>
  );
}

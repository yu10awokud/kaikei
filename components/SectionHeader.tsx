// クリーム色の帯を背景に敷いた見出し（現行 Notion ページの雰囲気に合わせる）
export default function SectionHeader({
  emoji,
  title,
  description,
}: {
  emoji: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-3">
      <h2 className="section-band">
        <span className="mr-2">{emoji}</span>
        {title}
      </h2>
      {description ? <p className="mt-1.5 px-1 text-xs text-neutral-500">{description}</p> : null}
    </div>
  );
}

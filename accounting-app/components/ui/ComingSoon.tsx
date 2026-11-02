// まだ作っていない画面に表示する案内（段階的に実装していくため）
export default function ComingSoon({ title, stage, items }: { title: string; stage: number; items: string[] }) {
  return (
    <section>
      <h1 className="mb-4 text-lg font-bold text-ink">{title}</h1>
      <div className="card p-5">
        <span className="tag mb-2 bg-aqua-50 text-aqua-700">第{stage}段階で実装予定</span>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-ink-soft">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

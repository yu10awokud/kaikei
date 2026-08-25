import type { AssignmentView } from '@/lib/types';

// ============================================================
// カレンダーのマスに並ぶ 1 件分のカード
//   ・担当者を主役にする（太字・大きめ）
//   ・練習場所は「左端の色ライン＋小さな場所名」で示す
//     （色タグだと横幅を食ってスマホで潰れるため）
//   ・オフの日は担当者を出さず、灰色で「オフ」とだけ出す
// ============================================================
export default function AssignmentCard({
  assignment,
  compact = false,
}: {
  assignment: AssignmentView;
  compact?: boolean;
}) {
  const { slot, member, place } = assignment;
  const slotLabel = slot === 'am' ? '午前' : slot === 'pm' ? '午後' : null;

  // オフの日
  if (place?.is_off) {
    return (
      <div
        className={`rounded-md bg-line-soft text-center font-medium text-ink-faint ${
          compact ? 'px-1 py-[3px] text-[10px] leading-tight' : 'px-2 py-1 text-xs'
        }`}
      >
        {slotLabel && <span className="mr-1">{slotLabel}</span>}
        オフ
      </div>
    );
  }

  const accent = place?.color ?? '#C9D2DA';

  return (
    <div
      className={`overflow-hidden rounded-md bg-white ${compact ? 'py-[3px] pl-1.5 pr-1' : 'py-1 pl-2 pr-1.5'}`}
      style={{ boxShadow: `inset 3px 0 0 ${accent}` }}
    >
      {slotLabel && (
        <div className={`font-medium text-ink-faint ${compact ? 'text-[9px] leading-tight' : 'text-[10px]'}`}>
          {slotLabel}
        </div>
      )}

      {/* 1 段目：担当者（主役） */}
      <div
        className={`truncate font-bold ${
          compact ? 'text-[11px] leading-snug' : 'text-sm'
        } ${member ? 'text-ink' : 'font-medium text-ink-faint'}`}
      >
        {member ? member.name : '未定'}
      </div>

      {/* 2 段目：練習場所（控えめに） */}
      {place && (
        <div
          className={`truncate font-medium ${compact ? 'text-[9px] leading-tight' : 'text-[11px]'}`}
          style={{ color: accent }}
        >
          {place.name}
        </div>
      )}
    </div>
  );
}

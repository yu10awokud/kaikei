import type { AssignmentView } from '@/lib/types';

// 1 件の割り当てカード（2 段構成）
//   1 段目：担当者名（太字）。未定なら「未定」を灰色で。
//   2 段目：練習場所を色付きタグで表示。
export default function AssignmentCard({
  assignment,
  compact = false,
}: {
  assignment: AssignmentView;
  compact?: boolean;
}) {
  const { slot, member, place } = assignment;
  const slotLabel = slot === 'am' ? '午前' : slot === 'pm' ? '午後' : null;
  const isOff = Boolean(place?.is_off);

  // オフの日は担当者を出さず、「オフ」とだけ灰色で表示する
  if (isOff) {
    return (
      <div
        className={`rounded-card border border-line bg-neutral-100 text-center text-neutral-500 ${
          compact ? 'px-1 py-0.5 text-[10px] leading-tight' : 'px-2 py-1.5 text-xs'
        }`}
      >
        {slotLabel && <span className="mr-1">{slotLabel}</span>}
        {place?.name ?? 'オフ'}
      </div>
    );
  }

  return (
    <div className={`rounded-card border border-line bg-white ${compact ? 'px-1 py-0.5' : 'px-2 py-1.5'}`}>
      {/* 二部練の日だけ「午前 / 午後」を小さく添える */}
      {slotLabel && (
        <div className={`text-neutral-400 ${compact ? 'text-[9px] leading-tight' : 'text-[10px]'}`}>
          {slotLabel}
        </div>
      )}

      <div
        className={`truncate font-bold ${compact ? 'text-[11px] leading-tight' : 'text-sm'} ${
          member ? '' : 'font-normal text-neutral-400'
        }`}
        style={member ? { color: member.color } : undefined}
      >
        {member ? member.name : '未定'}
      </div>

      {place && (
        <div className={compact ? 'mt-0.5' : 'mt-1'}>
          <span
            className={`tag truncate ${compact ? 'max-w-full px-1 py-0 text-[9px]' : ''}`}
            style={{
              borderColor: place.color,
              color: place.color,
              backgroundColor: `${place.color}14`, // 末尾 14 = 約 8% の透明度
            }}
          >
            {place.name}
          </span>
        </div>
      )}
    </div>
  );
}

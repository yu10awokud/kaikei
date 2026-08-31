import type { AssignmentView, RatioRow, SeasonSummary } from '@/lib/types';
import { formatSeasonLabel, getSeasonKeyFromDate, listSeasonKeys, type SeasonKey } from '@/lib/season';

// ============================================================
// 担当率の集計
//   ・部員が選ばれていないものは「未割り当て：n日」として別途数える
//   ・「その他」で名前を直接入力したものは、まとめて 1 行（その他）に数える
//   ・集計はすべてシーズン（9月始まり）単位
// ============================================================

/** 「その他（自由記述）」をまとめる際に使うキー */
const OTHER_KEY = 'other';

export function summarizeSeason(assignments: AssignmentView[], season: SeasonKey): SeasonSummary {
  const inSeason = assignments.filter((a) => getSeasonKeyFromDate(a.date) === season);

  const counter = new Map<string, RatioRow>();
  let unassigned = 0;

  for (const a of inSeason) {
    // 部員が選ばれている場合はその人として数える
    if (a.member_id && a.member) {
      const row = counter.get(a.member_id);
      if (row) {
        row.count += 1;
      } else {
        counter.set(a.member_id, {
          memberId: a.member_id,
          name: a.member.name,
          color: a.member.color,
          count: 1,
          percent: 0,
        });
      }
      continue;
    }

    // 「その他」で名前を直接入力した場合は、まとめて 1 つに数える
    if (a.custom_member) {
      const row = counter.get(OTHER_KEY);
      if (row) {
        row.count += 1;
      } else {
        counter.set(OTHER_KEY, {
          memberId: OTHER_KEY,
          name: 'その他',
          color: '#8A97A3',
          count: 1,
          percent: 0,
        });
      }
      continue;
    }

    unassigned += 1;
  }

  const rows = Array.from(counter.values()).sort((x, y) => y.count - x.count || x.name.localeCompare(y.name));
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  for (const r of rows) {
    r.percent = total === 0 ? 0 : Math.round((r.count / total) * 1000) / 10;
  }

  return { season, label: formatSeasonLabel(season), total, unassigned, rows };
}

/** データに含まれる全シーズンを新しい順に集計する */
export function summarizeAllSeasons(assignments: AssignmentView[], today = new Date()): SeasonSummary[] {
  return listSeasonKeys(assignments.map((a) => a.date), today).map((season) =>
    summarizeSeason(assignments, season)
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { SeasonSummary } from '@/lib/types';

// ============================================================
// 担当率タブ
//   ・ドーナツ型の円グラフ（中央に合計回数、その下に小さく Total）
//   ・PC は引き出し線つきラベル、スマホはグラフ下の凡例に切り替え
//   ・下に「名前／回数／割合」の表を併記
//   ・過去シーズンは折りたたみ（アコーディオン）
// ============================================================

export default function RatioChart({
  current,
  past,
}: {
  current: SeasonSummary;
  past: SeasonSummary[];
}) {
  // 画面幅が狭いときはラベルが重なるため、凡例方式に切り替える
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const data = current.rows.map((r) => ({ ...r, value: r.count }));

  return (
    <div className="space-y-4">
      <div className="card px-3 py-5">
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-faint">
            このシーズンの担当実績はまだありません。
          </p>
        ) : (
          <>
            <div className="relative mx-auto h-[260px] w-full sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 8, right: wide ? 90 : 8, bottom: 8, left: wide ? 90 : 8 }}>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="82%"
                    paddingAngle={1}
                    stroke="#ffffff"
                    strokeWidth={1}
                    isAnimationActive={false}
                    // スマホでは引き出し線とラベルを消して、下の凡例で読ませる
                    labelLine={wide ? { stroke: '#C9D2DA' } : false}
                    label={
                      wide
                        ? ({ name, count, percent }: { name?: string; count?: number; percent?: number }) =>
                            `${name} ${count} (${percent}%)`
                        : false
                    }
                  >
                    {data.map((row) => (
                      <Cell key={row.memberId} fill={row.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* 中央の合計表示 */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-en text-4xl font-semibold leading-none tracking-tight sm:text-5xl">{current.total}</div>
                <div className="font-en mt-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-faint">Total</div>
              </div>
            </div>

            {/* スマホ用の凡例 */}
            {!wide && (
              <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
                {current.rows.map((r) => (
                  <li key={r.memberId} className="flex items-center gap-1.5 text-[11px]">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: r.color }}
                    />
                    <span className="truncate">
                      {r.name} {r.count} ({r.percent}%)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <p className="font-en mt-5 text-center text-sm font-semibold text-ink-soft">{current.label}</p>
        {current.unassigned > 0 && (
          <p className="mt-1 text-center text-xs text-ink-faint">
            未割り当て：{current.unassigned}日
          </p>
        )}
      </div>

      {/* 表（スマホではこちらのほうが読みやすい） */}
      {current.rows.length > 0 && <RatioTable summary={current} />}

      {/* 過去シーズン */}
      {past.length > 0 && (
        <div className="space-y-2">
          <h3 className="px-1 text-[13px] font-bold text-ink-soft">過去シーズン</h3>
          {past.map((s) => (
            <details key={s.season} className="card overflow-hidden">
              <summary className="cursor-pointer px-3 py-2.5 text-sm font-bold tap">
                {s.label}（全{s.total}回）
              </summary>
              <div className="border-t border-line p-3">
                {s.rows.length === 0 ? (
                  <p className="py-4 text-center text-xs text-ink-faint">担当実績はありません。</p>
                ) : (
                  <RatioTable summary={s} bare />
                )}
                {s.unassigned > 0 && (
                  <p className="mt-2 text-xs text-ink-faint">未割り当て：{s.unassigned}日</p>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function RatioTable({ summary, bare = false }: { summary: SeasonSummary; bare?: boolean }) {
  return (
    <div className={bare ? '' : 'card overflow-hidden'}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-line-soft text-left text-[11px] font-medium text-ink-soft">
            <th className="px-3 py-2 font-bold">名前</th>
            <th className="px-3 py-2 text-right font-bold">回数</th>
            <th className="px-3 py-2 text-right font-bold">割合</th>
          </tr>
        </thead>
        <tbody>
          {summary.rows.map((r) => (
            <tr key={r.memberId} className="border-t border-line">
              <td className="px-3 py-2">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: r.color }}
                  />
                  {r.name}
                </span>
              </td>
              <td className="font-en px-3 py-2 text-right font-semibold tabular-nums">{r.count}</td>
              <td className="font-en px-3 py-2 text-right tabular-nums text-ink-faint">{r.percent}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-line bg-line-soft text-xs">
            <td className="px-3 py-2 font-bold">合計</td>
            <td className="font-en px-3 py-2 text-right font-bold tabular-nums">{summary.total}</td>
            <td className="px-3 py-2" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

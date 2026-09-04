// ============================================================
// 金額の読み取り
//   このアプリでは金額を必ず「1円以上の整数」として扱い、
//   浮動小数点数は一切使わない。
// ============================================================

/**
 * 入力された金額を整数（円）として読む。読めなければ null。
 *   ・小数（80.5）や数値でないものは受け付けない
 *   ・全角数字、桁区切りのカンマ、'¥' や '円' は取り除いてから判定する
 */
export function parseAmount(value: unknown): number | null {
  let raw: string;
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) return null;
    raw = String(value);
  } else if (typeof value === 'string') {
    raw = value;
  } else {
    return null;
  }

  const normalized = raw
    .trim()
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，\s¥￥円]/g, '');

  if (!/^\d+$/.test(normalized)) return null;

  const amount = Number(normalized);
  // 1円未満と、安全に扱える整数の範囲を超える値は弾く
  if (!Number.isSafeInteger(amount) || amount < 1) return null;
  return amount;
}

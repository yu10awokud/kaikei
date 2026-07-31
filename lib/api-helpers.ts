import { NextResponse } from "next/server";
import { verifyEditToken } from "./edit-auth";

/**
 * 編集系 API の入口で必ず呼ぶガード。
 *
 * 使い方:
 *   const denied = guardEdit(req);
 *   if (denied) return denied;      // ここで 401 が返る
 *   ...以降は編集モードが確認できた処理...
 *
 * 「クライアントが編集モードだと言っているから」ではなく、
 * 毎回サーバーがトークンを検証しているのがポイントです。
 * ブラウザ側の sessionStorage を書き換えても、ここは突破できません。
 */
export function guardEdit(req: Request): NextResponse | null {
  if (!verifyEditToken(req)) {
    return NextResponse.json(
      { error: "編集モードが解除されていません" },
      { status: 401 },
    );
  }
  return null;
}

/** Supabase のエラーをそのまま画面に出すための共通レスポンス */
export function dbError(message: string, detail?: unknown): NextResponse {
  console.error("[DB ERROR]", message, detail);
  return NextResponse.json({ error: message }, { status: 500 });
}

/** JSON ボディを安全に読む */
export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/** 空文字を null に変換する（フォームの未入力を DB の NULL にそろえるため） */
export function emptyToNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

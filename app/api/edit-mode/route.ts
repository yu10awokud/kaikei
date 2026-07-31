import { NextResponse } from "next/server";
import { expectedToken, verifyPassphrase } from "@/lib/edit-auth";

/**
 * Route Handler（＝自作の API）です。
 * app/api/edit-mode/route.ts に置くと URL は /api/edit-mode になります。
 *
 * このファイルのコードは 100% サーバーでしか動きません。
 * だから process.env.EDIT_PASSPHRASE を読んでも、ブラウザには一切漏れません。
 */

export async function POST(req: Request) {
  let body: { passphrase?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const input = body.passphrase ?? "";
  if (!input) {
    return NextResponse.json({ error: "合言葉を入力してください" }, { status: 400 });
  }

  if (!verifyPassphrase(input)) {
    // 「合言葉が違う」以上の情報は返さない（何文字か等のヒントを与えない）
    return NextResponse.json({ error: "合言葉が違います" }, { status: 401 });
  }

  // 合言葉ではなく、そこから作ったトークンを返す
  return NextResponse.json({ token: expectedToken() });
}

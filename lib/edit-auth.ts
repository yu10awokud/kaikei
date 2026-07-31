import { createHash, timingSafeEqual } from "crypto";

/**
 * 編集モードの仕組み（サーバー側）
 *
 * 1. ユーザーが合言葉を入力 → POST /api/edit-mode に送る
 * 2. サーバーが EDIT_PASSPHRASE と比較する（ここが唯一の照合ポイント）
 * 3. 一致したら「合言葉そのもの」ではなく、そこから作ったトークンを返す
 * 4. ブラウザはトークンを sessionStorage に保存し、編集APIを叩くたびヘッダに付ける
 * 5. 編集API は毎回このファイルの requireEditMode() で再検証する
 *
 * なぜ合言葉をそのまま返さないのか:
 *   sessionStorage は開発者ツールから中身が見えます。合言葉が入っていると
 *   画面を触った人が生の合言葉を知ってしまう（＝他人に伝えられる）。
 *   トークンなら、そのブラウザで編集はできても合言葉自体は分からないままです。
 *
 * このトークンは「合言葉を知っている証明」でしかなく、有効期限もありません。
 * 個人情報を扱わない部内ツールという前提での、軽量な割り切りです。
 */

const TOKEN_SALT = "kaikei-pool-edit-mode-v1";

function passphrase(): string {
  const p = process.env.EDIT_PASSPHRASE;
  if (!p) {
    throw new Error(
      "環境変数 EDIT_PASSPHRASE が設定されていません。.env.local に追加してください。",
    );
  }
  return p;
}

/** 正解のトークン（合言葉のハッシュ）を作る */
export function expectedToken(): string {
  return createHash("sha256").update(`${TOKEN_SALT}:${passphrase()}`).digest("hex");
}

/**
 * 文字列比較を timingSafeEqual で行う。
 * a === b だと「何文字目まで合っていたか」が処理時間の差として漏れる可能性があるため、
 * 認証まわりでは長さに関係なく一定時間で比較する関数を使うのが定石です。
 */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** 入力された合言葉が正しいか */
export function verifyPassphrase(input: string): boolean {
  return safeEqual(input, passphrase());
}

/** リクエストヘッダのトークンが正しいか */
export function verifyEditToken(req: Request): boolean {
  const token = req.headers.get("x-edit-token");
  if (!token) return false;
  try {
    return safeEqual(token, expectedToken());
  } catch {
    return false;
  }
}

/** ヘッダ名を定数化（クライアント側と共有する） */
export const EDIT_TOKEN_HEADER = "x-edit-token";

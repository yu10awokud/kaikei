/**
 * 環境変数が未設定 / DB 未作成のときに出すガイド。
 * 真っ白なエラー画面より、次にやることが分かるほうが親切なので用意しています。
 */
export function SetupNotice({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-5">
      <h2 className="font-bold text-amber-900">まだ準備が終わっていないようです</h2>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-amber-900">
        <li>
          <code className="rounded bg-amber-100 px-1">.env.local.example</code> を{" "}
          <code className="rounded bg-amber-100 px-1">.env.local</code>{" "}
          にコピーし、Supabase の URL と anon キー、EDIT_PASSPHRASE を入れる
        </li>
        <li>
          Supabase の SQL Editor で{" "}
          <code className="rounded bg-amber-100 px-1">supabase/schema.sql</code> →{" "}
          <code className="rounded bg-amber-100 px-1">supabase/seed.sql</code> を実行する
        </li>
        <li>
          開発サーバーを再起動する（<code className="rounded bg-amber-100 px-1">npm run dev</code>）
          … .env.local は起動時にしか読まれません
        </li>
      </ol>
      <p className="mt-3 text-xs text-amber-800">エラー内容: {message}</p>
    </div>
  );
}

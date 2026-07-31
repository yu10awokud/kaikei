# プール予約管理アプリ セットアップガイド

水泳部の「プール予約係 兼 会計」の業務を管理する Web アプリです。
Next.js 15 (App Router) + TypeScript + Tailwind CSS + Supabase で作られています。

---

## 目次

1. [できること](#できること)
2. [ローカルで動かす](#ローカルで動かす)
3. [Supabase の準備](#supabase-の準備)
4. [環境変数](#環境変数)
5. [Vercel へデプロイする](#vercel-へデプロイする)
6. [Server Component と Client Component の使い分け](#server-component-と-client-component-の使い分け)
7. [自動タスク算出の仕組み](#自動タスク算出の仕組み)
8. [編集モードの仕組みとセキュリティ](#編集モードの仕組みとセキュリティ)
9. [印刷（PDF出力）](#印刷pdf出力)
10. [ファイル構成](#ファイル構成)

---

## できること

| 画面 | パス | 内容 |
|---|---|---|
| TOP | `/` | 今月のカレンダー概観、次のイベントまであと〇日、要対応リスト（手動タスク + 自動算出タスク） |
| タスク | `/tasks` | 手動タスクの追加・編集・削除・完了チェック |
| プールマスタ | `/pools` | 施設の連絡先・受付ルール・手順メモ、曜日×季節の優先順位 |
| カレンダー | `/calendar` | 月表示の予定管理、曜日まとめ登録、印刷 |

閲覧はログイン不要。編集は右上の「編集モード」で合言葉を入れると解除されます。

---

## ローカルで動かす

```bash
# 1. 依存パッケージのインストール（初回のみ）
npm install

# 2. 環境変数ファイルを用意
cp .env.local.example .env.local
#    → .env.local を開いて中身を埋める（次の章を参照）

# 3. 開発サーバー起動
npm run dev
#    → http://localhost:3000 を開く
```

その他のコマンド:

```bash
npm run build        # 本番用ビルド（Vercel が実行するのと同じもの）
npm run typecheck    # 型エラーのチェック
npm run check:logic  # 年またぎ判定・受付開始日・自動タスク生成の動作検証
```

> `npm run check:logic` は Supabase なしで動きます。
> 予約ルールをいじったときは、まずこれを走らせると安心です。

---

## Supabase の準備

1. https://supabase.com でプロジェクトを作る（無料プランでOK）
2. 左メニューの **SQL Editor** を開く
3. `supabase/schema.sql` の中身をまるごと貼り付けて **Run**
   （テーブル5つと索引、RLS ポリシーが作られます）
4. 続けて `supabase/seed.sql` を貼り付けて **Run**
   （プール8件と優先順位13件が入ります）
5. 最後に出る一覧表で、火曜/木曜/土曜の優先順位が想定どおりか確認

> ⚠ `schema.sql` は先頭で `drop table` しています。
> 運用を始めたあとに再実行するとデータが消えるので注意してください。

---

## 環境変数

`.env.local.example` をコピーして `.env.local` を作り、次の3つを設定します。

| 変数名 | どこで手に入るか | 用途 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > Data API > Project URL | 接続先 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Project Settings > API Keys > `anon public` | 接続キー |
| `EDIT_PASSPHRASE` | 自分で決める | 編集モードの合言葉 |

**`NEXT_PUBLIC_` が付くかどうかが重要です。**

- 付いている → ブラウザにも埋め込まれる（＝誰でも見られる）
- 付いていない → サーバーでしか読めない（＝秘密にできる）

`EDIT_PASSPHRASE` にわざと `NEXT_PUBLIC_` を付けていないのはこのためです。

---

## Vercel へデプロイする

### 1. GitHub にプッシュ

このリポジトリを GitHub に push します（すでに push 済みならそのままでOK）。

### 2. Vercel にインポート

1. https://vercel.com にログイン（GitHub アカウントでログインすると楽です）
2. **Add New… > Project** → このリポジトリを **Import**
3. Framework Preset が **Next.js** になっていることを確認
   （`next.config.ts` があるので自動判定されます）
4. Root Directory は変更不要（このリポジトリの直下がアプリ本体です）

### 3. 環境変数を登録

Import 画面の **Environment Variables**、または後から
**Project > Settings > Environment Variables** で次を追加します。

| Key | Value | 対象環境 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Production / Preview / Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | 同上 |
| `EDIT_PASSPHRASE` | 部内で共有する合言葉 | 同上 |
| `TZ` | `Asia/Tokyo` | 同上（**推奨**） |

`TZ` について:
Vercel のサーバーは標準では UTC で動きます。
このアプリは `lib/date-utils.ts` の `today()` で明示的に日本時間を計算しているので
`TZ` が無くても日付はずれませんが、ログの時刻表示などが分かりやすくなるので
設定しておくことをおすすめします。

### 4. Deploy

**Deploy** を押すと数十秒でビルドが終わり、
`https://<プロジェクト名>.vercel.app` の URL が発行されます。
この URL を部員に共有すれば、ログインなしで予定表を見てもらえます。

> 環境変数を後から変更したときは、**Deployments > … > Redeploy** が必要です。
> 環境変数はビルド時／起動時に読み込まれるため、保存しただけでは反映されません。

---

## Server Component と Client Component の使い分け

Next.js の App Router では、ファイルの先頭に `"use client"` があるかどうかで
コンポーネントの動く場所が変わります。ここが一番の学びどころです。

### Server Component（`"use client"` なし）

- **サーバーでだけ**実行される。コードはブラウザに送られない
- `async` / `await` をコンポーネントに直接書ける
- DB アクセス、秘密の環境変数の読み取りができる
- `useState` / `useEffect` / `onClick` は **使えない**

このアプリでの例:

| ファイル | 役割 |
|---|---|
| `app/page.tsx` | TOP。Supabase から events / tasks / pools / priorities / logs をまとめて取得 |
| `app/calendar/page.tsx` | 表示月の予定を取得 |
| `app/tasks/page.tsx` | タスク一覧を取得 |
| `app/pools/page.tsx` | pools と pool_priorities を `Promise.all` で並行取得 |
| `app/layout.tsx` | 全ページ共通の外枠 |

### Client Component（`"use client"` あり）

- サーバーで一度描画されたあと、ブラウザでも動く
- `useState` / `useEffect` / `onClick` が使える
- **DB に直接アクセスしない**（このアプリの方針）。代わりに `/api/...` を呼ぶ

このアプリでの例:

| ファイル | なぜ Client なのか |
|---|---|
| `components/EditModeProvider.tsx` | `sessionStorage` を読み書きする（ブラウザにしかない） |
| `components/TabNav.tsx` | `usePathname()` で現在のページを判定する |
| `components/calendar/CalendarBoard.tsx` | 日付クリックでモーダルを開く（`useState`） |
| `components/top/TopDashboard.tsx` | 「取れなかった」を押した直後の強調表示に `useState` が要る |
| `components/pools/PoolManager.tsx` | フォームの入力状態を持つ |

### 組み合わせ方（このアプリの型）

```
app/calendar/page.tsx          ← Server: DB から読む
        │  props で渡す（ただの配列・文字列だけ）
        ▼
components/calendar/CalendarBoard.tsx   ← Client: 表示とクリック処理
        │  fetch('/api/events', ...)
        ▼
app/api/events/route.ts        ← Server: 合言葉を検証して DB を更新
        │
        ▼
router.refresh()               ← Server Component を再実行して画面を最新化
```

`router.refresh()` は「サーバー側のページをもう一度取りに行く」命令です。
自分で `useState` の配列を書き換えて画面を更新する方法もありますが、
DB の実際の状態とズレやすいので、このアプリでは常に `refresh()` を使っています。

`components/calendar/EventDialog.tsx` の `save()` 関数が、この流れの実例です。

### 注意: Server → Client に渡せるもの

Server Component から Client Component へ props で渡せるのは、
文字列・数値・配列・オブジェクトなど「そのまま JSON にできるもの」です。
関数はそのままでは渡せません。

TOP画面で自動タスクの計算を **Client 側** でやっているのはこれも理由の一つです。
`Date` 型を props に含めずに済むよう、サーバーからは DB の行をそのまま渡し、
`Date` を作るのは Client 側（`lib/auto-tasks.ts` の呼び出し）にしています。

---

## 自動タスク算出の仕組み

定期実行（cron）は使いません。**TOP画面を開いた瞬間にその場で計算**します。
実装は `lib/auto-tasks.ts` の `buildAutoTaskGroups()` です。

```
1. 対象の「利用月」= 今月・翌月・翌々月 の3か月
2. 各 pool_priorities について、その利用月が start_month〜end_month に入るか判定
      → isMonthInRange()（年またぎ対応）
3. pool の rule_type / rule_value から受付開始日を計算
      → calcOpenDate()
        months_before : 利用月の N か月前の1日
        fixed_day     : 利用月の前月の N 日
        unknown       : null（＝「調査」タスクとして常時表示）
4. base（既定は今日）>= 受付開始日 - lead_days なら要対応として表示
5. routine_logs に (pool_id, target_month, weekday) の記録があれば除外
6. method に応じて文言を自動生成
7. 曜日 × 利用月 でグループ化し、rank 昇順に並べる
```

### 年またぎの扱い（重要）

`start_month > end_month` は年をまたぐ期間を意味します。

```
start_month=9, end_month=4  →  9,10,11,12,1,2,3,4月
start_month=10, end_month=3 →  10,11,12,1,2,3月
```

判定は必ず `isMonthInRange()`（`lib/date-utils.ts`）を通してください。
自分で `month >= start && month <= end` と書くと冬期の枠が丸ごと消えます。

```ts
export function isMonthInRange(month, startMonth, endMonth) {
  if (startMonth <= endMonth) return month >= startMonth && month <= endMonth;
  return month >= startMonth || month <= endMonth;  // 年またぎ
}
```

この動作は `npm run check:logic` で検証しています。

### ボタンを押したとき

「予約できた / 取れなかった / 見送り」を押すと `POST /api/routine-logs` が呼ばれ、
`(pool_id, target_month, weekday)` のユニーク制約に対して **upsert** します。
記録が入るとその候補は次回の算出で除外され、リストから消えます。
「取れなかった」の場合は、残った先頭の候補に「← 次はここ」の強調が付きます。

---

## 編集モードの仕組みとセキュリティ

```
[ブラウザ] 合言葉を入力
     │  POST /api/edit-mode { passphrase }
     ▼
[サーバー] EDIT_PASSPHRASE と比較（照合はここだけ）
     │  一致 → 合言葉から作ったトークン（SHA-256ハッシュ）を返す
     ▼
[ブラウザ] sessionStorage にトークンを保存
     │  以降の編集APIに x-edit-token ヘッダを付ける
     ▼
[サーバー] 毎回 guardEdit() でトークンを検証（lib/api-helpers.ts）
```

ポイント:

- 合言葉そのものはブラウザに返しません。開発者ツールを見てもトークンしか分かりません。
- クライアントの状態は信用しません。編集系 API は **毎回** サーバーで検証します。
- `sessionStorage` はタブを閉じると消えます（部室の共用PC対策）。

### 知っておいてほしい限界

`NEXT_PUBLIC_SUPABASE_ANON_KEY` はブラウザに埋め込まれる公開情報です。
現在の RLS 設定（`anon full access`）では、技術的には
「URL と anon キーを知っている人が Supabase を直接叩いてデータを書き換える」ことが可能です。
個人情報を扱わない部内ツールという前提での割り切りですが、
もう一段固めたい場合は `supabase/schema.sql` 末尾の手順に従って

1. RLS を「anon は SELECT のみ」に変更
2. Vercel と `.env.local` に `SUPABASE_SERVICE_ROLE_KEY` を追加

してください。`lib/supabase.ts` はこの環境変数があれば自動でそちらを使います。
（`SUPABASE_SERVICE_ROLE_KEY` は `NEXT_PUBLIC_` を付けないこと。絶対に公開しないでください）

---

## 印刷（PDF出力）

PDF ライブラリは使いません。カレンダー画面の「🖨 印刷 / PDF」ボタンが
`window.print()` を呼び、ブラウザの印刷機能を使います。
印刷ダイアログの「送信先」で **PDFに保存** を選べば PDF になります。

印刷用の指定は `app/globals.css` の `@media print { ... }` にまとまっています。

- `@page { size: A4 landscape; }` … A4横固定
- `.no-print` … タブ・ボタン・モーダルを非表示に
- `.print-only` … 印刷のときだけ出す（年月の大きなタイトル）
- カレンダー本体は高さ `170mm` 固定で、必ず1枚に収まります
- 種別は **色 + 記号 + 枠線** の三重で区別
  - 練習 = 青 / ● / 細い実線
  - イベント = 橙 / ▲ / 太い実線
  - オフ = 灰 / − / 破線

白黒プリンタでも記号と枠線で判別できます。

> 印刷プレビューで背景色が出ない場合は、印刷ダイアログの
> 「背景のグラフィック」にチェックを入れてください。

---

## ファイル構成

```
app/
  layout.tsx              全ページ共通の外枠（Server）
  globals.css             Tailwind の読み込み + 印刷用CSS
  page.tsx                TOP（Server）
  calendar/page.tsx       カレンダー（Server）
  tasks/page.tsx          タスク（Server）
  pools/page.tsx          プールマスタ（Server）
  api/
    edit-mode/route.ts        合言葉の照合
    events/route.ts           予定 一覧・追加
    events/[id]/route.ts      予定 更新・削除
    events/bulk/route.ts      曜日まとめ登録
    tasks/route.ts            タスク 一覧・追加
    tasks/[id]/route.ts       タスク 更新・削除
    pools/route.ts            プール 一覧・追加
    pools/[id]/route.ts       プール 更新・削除
    pool-priorities/…         優先順位 CRUD
    routine-logs/route.ts     予約結果の記録（upsert）

components/
  EditModeProvider.tsx    編集モードの状態を配る（Client）
  EditModeButton.tsx      右上のボタン（Client）
  TabNav.tsx              共通タブ（Client）
  SetupNotice.tsx         未設定時のガイド
  ui/Modal.tsx            使い回すモーダルとフォーム部品
  calendar/               CalendarBoard / EventDialog / BulkDialog
  tasks/TaskManager.tsx
  pools/PoolManager.tsx
  top/TopDashboard.tsx

lib/
  supabase.ts             Supabase クライアント生成
  types.ts                DB の型定義と日本語ラベル
  date-utils.ts           日付計算（年またぎ判定・受付開始日・カレンダー生成）
  auto-tasks.ts           自動タスク算出の中核
  edit-auth.ts            合言葉とトークンの検証（サーバー専用）
  api-helpers.ts          API 共通処理（guardEdit など）
  validators.ts           入力チェック
  task-sort.ts            タスクの並び替え規則
  constants.ts            クライアントとも共有する定数

supabase/
  schema.sql              テーブル定義（DDL）
  seed.sql                初期データ

tests/
  logic-check.ts          中核ロジックの検証（npm run check:logic）
```

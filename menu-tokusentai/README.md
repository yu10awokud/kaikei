# メニュー特戦隊

大学水泳部「メニュー係」の管理サイトです。
Notion で運用していた内容（テンプレート配布・マニュアル・担当表・リンク集）を Web アプリにしたものです。

- **ログイン機能はありません。** URL を知っている人なら誰でも閲覧・編集できます。
- スマホからの利用を最優先に作っています。

---

## 目次

1. [できること](#できること)
2. [使っている技術](#使っている技術)
3. [初回セットアップ（自分のパソコンで動かす）](#初回セットアップ自分のパソコンで動かす)
4. [Vercel へのデプロイ手順](#vercel-へのデプロイ手順)
5. [あとから中身を差し替える場所](#あとから中身を差し替える場所)
6. [過去実績を CSV から取り込む](#過去実績を-csv-から取り込む)
7. [困ったときは](#困ったときは)

---

## できること

| セクション | 内容 |
| --- | --- |
| ① テンプレート | Excel テンプレートのダウンロードとバージョン履歴 |
| ② マニュアル | usage / tips / archive の 3 ページ（本文は Markdown） |
| ③ メニュー担当 | 月カレンダー・リスト表示・担当の登録／編集・担当率グラフ |
| ④ リンク集 | 部活動 HP などの外部リンク |
| ⑤ 管理画面 `/admin` | 部員・練習場所の設定、削除した割り当ての復元 |

**運用上のポイント**

- 練習場所だけ先に決まり、担当者は後から決まります。担当者が空の日は「**未定**」と灰色で表示されます（異常ではありません）。
- 締切はありません。過去・未来どちらの日でも、いつでも自由に登録・修正できます。
- 二部練の日は「午前 / 午後」に分けて登録できます。
- 削除しても**データは残ります**（論理削除）。管理画面からいつでも復元できます。
- 引退・卒業した部員は削除せず、管理画面で「在籍中」のチェックを外してください。過去の集計が壊れません。
- 集計は **9 月始まりのシーズン**単位です（9/1 〜 翌年 8/31 を「2026-2027シーズン」と表記）。

---

## 使っている技術

- **Next.js（App Router / TypeScript）** … サイトの本体
- **Tailwind CSS** … 見た目の指定
- **Supabase（PostgreSQL）** … データの保存先
- **Recharts** … 担当率のグラフ
- **Vercel** … サイトを公開する場所（無料の Hobby プランでOK）

**安全のための決まりごと**

- データベースへの書き込みは、必ず `app/api/...`（**Route Handler** ＝ サーバー側でだけ動く処理）を通します。
- 全権限を持つ `SUPABASE_SERVICE_ROLE_KEY` は `lib/supabase-server.ts` の中だけで使い、ブラウザには渡しません。
- `.env.local`（キーを書くファイル）は `.gitignore` で除外済みです。**GitHub に上げないでください。**

---

## 初回セットアップ（自分のパソコンで動かす）

### 1. データベースを作る

Supabase のダッシュボードで **SQL Editor** を開き、次の順に貼り付けて実行します。

1. `supabase/schema.sql` … テーブルを作る
2. `supabase/seed.sql` … 部員 12 名・練習場所 3 件・動作確認用のダミーを入れる

**Table Editor** に `members` / `places` / `assignments` が並べば成功です。

### 2. 環境変数を設定する

1. `.env.local.example` をコピーして、同じ場所に **`.env.local`** という名前で保存します。
2. Supabase の **Project Settings → API** にある値を貼り付けます。

   | 書く場所 | 貼る値 |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` キー |
   | `SUPABASE_SERVICE_ROLE_KEY` | `service_role` キー（**秘密**） |

> `NEXT_PUBLIC_` が付いた変数はブラウザにも渡ります。強い権限のキーには**絶対に付けないでください**。

### 3. 起動する

ターミナルでこのフォルダ（`menu-tokusentai`）に移動して：

```bash
npm install
npm run dev
```

ブラウザで <http://localhost:3000> を開きます。

---

## Vercel へのデプロイ手順

初めてでも順番どおりに進めれば公開できます。

1. **GitHub にコードを上げる**
   このリポジトリを GitHub に push します（`.env.local` は除外されているので安全です）。

2. **Vercel にログインする**
   <https://vercel.com> を開き、GitHub アカウントでログインします。

3. **プロジェクトを作る**
   `Add New…` → `Project` を選び、このリポジトリを `Import` します。

4. **Root Directory を指定する ★重要**
   設定画面の **Root Directory** で `menu-tokusentai` を選びます。
   （リポジトリの直下に別のアプリが入っているためです）

5. **Framework Preset を確認する**
   自動で `Next.js` と表示されます。ビルドコマンド等はそのままで大丈夫です。

6. **環境変数を登録する**
   `Environment Variables` に、`.env.local` と同じ 3 つを 1 つずつ追加します。

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

   ※ Production / Preview / Development すべてにチェックを入れておくと迷いません。

7. **Deploy を押す**
   1〜2 分で完了し、`https://〇〇.vercel.app` の URL が発行されます。

8. **動作を確認する**
   発行された URL をスマホで開き、カレンダーに部員が表示されるか確認します。
   この URL を部員に共有すれば運用開始です。

9. **あとから直したいとき**
   コードを直して GitHub に push すれば、Vercel が自動で再デプロイします。
   環境変数を変えたときだけ、Vercel の画面から `Redeploy` を押してください。

---

## あとから中身を差し替える場所

| 変えたいもの | 触るファイル |
| --- | --- |
| Excel テンプレート本体 | `public/templates/kpumswim_template.xlsx` を上書き |
| テンプレートの版数・更新履歴 | `data/template.ts`（配列の**先頭が最新**。新しい版を先頭に追加） |
| マニュアルの本文 | `content/usage.md` / `content/tips.md` / `content/archive.md` |
| リンク集 | `data/links.ts` |
| 部員・練習場所・色 | サイトの `/admin`（管理画面）から変更 |
| シーズンの計算ルール | `lib/season.ts` |

---

## 過去実績を CSV から取り込む

1. 次の形式で CSV を用意します（1 行目は見出し）。

   ```csv
   date,slot,member_name,place_name
   2025-09-05,all_day,川村,イリアス
   2025-09-12,am,小田,アクアリーナ
   2025-09-12,pm,,アクアリーナ
   ```

   - `slot` は空欄なら `all_day`（終日）扱いです。
   - `member_name` が空欄なら「担当者未定」として登録されます。

2. 変換します。

   ```bash
   npm run import-csv -- 過去実績.csv
   ```

   `supabase/seed_assignments.sql` が作られます。

3. できた SQL を Supabase の **SQL Editor** に貼って実行します。
   （同じ日・同じ枠がすでにある場合は追加されないので、何度実行しても安全です）

---

## 困ったときは

| 症状 | 対処 |
| --- | --- |
| 「Supabase の環境変数が設定されていません」と出る | `.env.local` の 3 つの値を確認し、`npm run dev` を再起動する |
| 保存時に「終日と午前/午後は同時に登録できません」と出る | その日は二部練で登録済みです。モーダルの「二部練にする」を ON にしてから編集してください |
| 担当者プルダウンに部員が出てこない | 管理画面でその部員の「在籍中」にチェックが入っているか確認してください |
| 消してしまった | 管理画面 `/admin` の「削除した割り当て」から復元できます |

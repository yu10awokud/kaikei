# 水泳部 会計管理システム

水泳部の会計担当が扱う 3 つの会計（**部費・プリペイド・後援会費**）の収支を一元管理するアプリです。

- 入力の正本は **Supabase**。Google スプレッドシートは閲覧・バックアップ用の写し（システムから書き出すだけ）
- **Google ログイン**。`allowed_users` に登録したメールアドレスの人だけが使えます
- このフォルダ（`accounting-app/`）だけで完結した、独立した Next.js アプリです

---

## 実装の進み具合

| 段階 | 内容 | 状態 |
| --- | --- | --- |
| 1 | Supabase のスキーマ・RLS・シードデータ、Google ログイン | ✅ 完了 |
| 2 | テンプレート機能（初期4種）、汎用取引入力、取引一覧（取消含む） | 未着手 |
| 3 | スプレッドシート出力（3シート、変更時の再生成） | 未着手 |
| 4 | ビューとホーム画面の集計、照合画面 | 未着手 |
| 5 | 「よく使う項目に登録」機能、マスタ管理 | 未着手 |
| 6 | 締めレポート、Vercel Cron | 未着手 |

---

## 基本の考え方

1 件の取引を **会計区分（fund）** と **口座（account）** の 2 軸で記録します。残高はテーブルに保存せず、すべてビューで計算します（第4段階）。

| 軸 | 値 |
| --- | --- |
| 会計区分 | 部費（club_fee）／プリペイド（prepaid）／後援会費（supporters） |
| 口座 | 現金（cash）／部活三井住友（club_bank）／立替（会計担当）（advance） |
| 対象月 | どの月の利用・徴収に対する取引か（支払日とは別に持つ） |

検算式（常に成り立つはず）：

```
3会計の残高合計 ＝ 現金残高 ＋ 部活口座残高 ＋ 立替口座残高（立替はマイナス値）
```

### データベース側の守り（第1段階で実装済み）

| 守り | 内容 |
| --- | --- |
| RLS | `allowed_users` に入っていない人には 1 行も見えず、書き込みもできない |
| 物理削除の禁止 | 取引（transactions）は誰であっても削除できない（service_role でも拒否） |
| 内容変更の禁止 | 取引で変更できるのは「取消（voided：false→true のみ）」と「確認済み日」だけ。修正は取消＋再登録 |
| 振替のチェック | 口座を空欄にできるのは種別「振替」のときだけ |
| 対象月の補完 | 未指定なら支払日の月、指定したら月初日に自動で丸める |
| 金額 | 整数・1 円以上 |

種別マスタには `code` 列（`pool_fee` など）を追加しています。集計はこの code で行うため、種別の**名前**は後から自由に変更できます。

---

## 初回セットアップ（第1段階）

### 1. Supabase のプロジェクトを新しく作る

> ⚠ **メニュー特戦隊・立替アプリとは別のプロジェクトにしてください。**
> 両方に `members` テーブルがあり、同じプロジェクトだと壊れます。
> （間違えて実行した場合は、SQL がエラーで止まるようにしてあります）

1. <https://supabase.com/dashboard> → `New project`
2. Region は `Northeast Asia (Tokyo)` を推奨

### 2. テーブルを作る

1. `supabase/002_seed.sql` の **`your-address@gmail.com` を自分の Google アカウントのメールアドレス（小文字）に書き換える**
2. SQL Editor で次の順に貼り付けて実行
   1. `supabase/001_schema.sql`
   2. `supabase/002_seed.sql`
3. Table Editor に 9 個のテーブルが並べば成功です

> 施設（イリアス：都度払い／アクアリーナ：月締め振込）と部員は**仮の値**です。Table Editor で実際の内容に直してください（第5段階でマスタ管理画面からも編集できるようになります）。

### 3. Google ログインを設定する

#### 3-1. Google Cloud で OAuth クライアントを作る

1. <https://console.cloud.google.com/> でプロジェクトを作成（スプレッドシート出力用と同じプロジェクトで構いません）
2. `APIとサービス` → `OAuth 同意画面`
   - User Type：**外部**
   - アプリ名・サポートメールを入力して保存
   - 公開ステータスは「テスト」のままで OK。その場合は **テストユーザー** にログインする人の Gmail を追加します
3. `APIとサービス` → `認証情報` → `認証情報を作成` → `OAuth クライアント ID`
   - アプリケーションの種類：**ウェブ アプリケーション**
   - 承認済みのリダイレクト URI に次を追加
     ```
     https://<SupabaseのプロジェクトID>.supabase.co/auth/v1/callback
     ```
     （Supabase の `Authentication` → `Sign In / Providers` → `Google` を開くと、この URL が表示されています）
4. 発行された **クライアント ID** と **クライアント シークレット** を控える

#### 3-2. Supabase 側で Google を有効にする

1. `Authentication` → `Sign In / Providers` → `Google` を ON
2. 3-1 のクライアント ID・シークレットを貼って保存
3. `Authentication` → `URL Configuration`
   - **Site URL**：本番の URL（例：`https://xxxx.vercel.app`）。まだ無ければ `http://localhost:3000`
   - **Redirect URLs** に次を追加
     ```
     http://localhost:3000/auth/callback
     https://xxxx.vercel.app/auth/callback
     ```

### 4. 環境変数を設定する

`.env.example` をコピーして `.env.local` を作り、Supabase の `Project Settings` → `API Keys` / `Data API` の値を貼ります。

| 変数 | 値 | 第1段階で必要か |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | 必要 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public キー | 必要 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role キー（**秘密**） | 第3段階から |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` / `SPREADSHEET_ID` | スプレッドシート出力用 | 第3段階から |
| `CRON_SECRET` | 夜間処理の合言葉 | 第6段階から |

### 5. 起動する

```bash
cd accounting-app
npm install
npm run dev
```

<http://localhost:3000> を開きます。

---

## 第1段階の動作確認手順

| # | 操作 | 期待する結果 |
| --- | --- | --- |
| 1 | <http://localhost:3000> を開く | ログイン画面に自動で移動する |
| 2 | 「Google でログイン」→ **allowed_users に登録したアカウント**を選ぶ | ホームに戻り「接続確認」がすべて OK、口座 3 件・種別 12 件・施設 2 件・部員 12 名が表示される |
| 3 | 右上の ☰（ハンバーガー）を押す | 右からメニューが出る。Esc・背景タップ・×で閉じる |
| 4 | メニューから「取引一覧」などを開く | パンくずリスト（ホーム › 取引一覧）が出る。中身は「第◯段階で実装予定」 |
| 5 | ホームのアコーディオン（種別・施設など）を押す | 開閉する |
| 6 | メニュー下部の「ログアウト」 | ログイン画面に戻る |
| 7 | **登録していない** Google アカウントでログイン | 「利用許可がありません」と表示され、ログインできない |
| 8 | Supabase の SQL Editor で次を実行 | エラー「取引は削除できません」が出る（物理削除の禁止） |

手順 8 で使う SQL：

```sql
insert into transactions (paid_on, fund, direction, type_id, amount, account_id)
values (current_date, 'club_fee', 'income',
        (select id from transaction_types where code = 'other'), 1,
        (select id from accounts where kind = 'cash'))
returning id, target_month;

delete from transactions;  -- ← ここでエラーになれば OK
```

確認後、テスト行は次で取り消してください（物理削除はできないため、取消で残ります）。

```sql
update transactions set voided = true where voided = false;
```

---

## Vercel へのデプロイ

1. Vercel で `Add New…` → `Project` → このリポジトリを `Import`
2. **Root Directory に `accounting-app` を指定**（重要。指定しないとメニュー特戦隊がデプロイされます）
3. Environment Variables に `.env.local` と同じ値を登録
4. `Deploy`
5. 発行された URL を、Supabase の `URL Configuration`（Site URL と Redirect URLs）に追加

---

## ファイル構成

| 場所 | 役割 |
| --- | --- |
| `supabase/001_schema.sql` | テーブル・列挙型・トリガー・RLS |
| `supabase/002_seed.sql` | 許可ユーザー・口座・種別・施設・部員の初期データ |
| `middleware.ts` | ログインのクッキー更新、未ログイン時のログイン画面への移動 |
| `lib/auth.ts` | ログイン状態と利用許可（allowed_users）の確認 |
| `lib/supabase/server.ts` | ログイン中ユーザーとして接続（RLS が効く）。通常の読み書きはすべてこれ |
| `lib/supabase/admin.ts` | 全権限での接続。スプレッドシート出力と夜間処理だけで使う |
| `lib/nav.ts` | メニュー構成とパンくずの表示名 |
| `components/layout/AppShell.tsx` | ヘッダー・ハンバーガーメニュー・パンくず |
| `components/ui/` | モーダル・アコーディオンなどの共通部品 |

---

## 困ったときは

| 症状 | 対処 |
| --- | --- |
| 「初期設定が必要です」と出る | `.env.local` の 2 つの値を確認し、`npm run dev` を再起動 |
| ログイン後に「利用許可がありません」 | `allowed_users` に**小文字**でメールアドレスが入っているか確認 |
| Google の画面で `redirect_uri_mismatch` | Google Cloud の「承認済みのリダイレクト URI」が `https://〇〇.supabase.co/auth/v1/callback` になっているか確認 |
| ログイン後に localhost ではなく別の URL に飛ぶ | Supabase の `URL Configuration` → Redirect URLs に `http://localhost:3000/auth/callback` があるか確認 |
| Google の画面で「アクセスをブロック」 | OAuth 同意画面の「テストユーザー」にそのアカウントを追加 |

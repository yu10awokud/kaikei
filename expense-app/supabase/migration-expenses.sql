-- ============================================================
-- 立替精算アプリ / テーブル定義
--   既存サイト（メニュー特戦隊）と同じ Supabase プロジェクトに追加します。
--   既存のテーブル（members / places / assignments など）は
--   一切変更しません。読み取るだけです。
--
--   使い方：Supabase ダッシュボード → SQL Editor に貼り付けて実行。
--   何度実行しても壊れないように書いてあります。
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1) 領収書画像の置き場所（ストレージのバケット）
--    receipts という入れ物を「非公開」で作ります。
--    領収書は個人のお金の情報なので、URL を知っていても
--    そのままでは開けないようにし、画面に出すときだけ
--    サーバー側で有効期限つきの URL を発行します。
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do update set public = false;

-- 匿名キーからの読み書きポリシーは作りません。
-- （ポリシーが無い＝匿名キーでは一切さわれない。
--   アップロードも閲覧用URLの発行も、サーバー側の service_role だけが行います）
drop policy if exists "receipts are readable by everyone" on storage.objects;

-- ------------------------------------------------------------
-- 2) expenses（立替の記録）
--    1 行 = 「誰が・いつの練習で・いくら立て替えたか」1 件
-- ------------------------------------------------------------
create table if not exists public.expenses (
  id              uuid        primary key default gen_random_uuid(),

  -- ---- どの練習の支出か -------------------------------------
  -- 既存の assignments（練習1コマ）への紐付け。
  -- 練習の登録が消されても立替の記録は残したいので、
  -- 消えたときは null になるだけにして、下の3つの控えで表示を続けます。
  assignment_id   uuid        references public.assignments (id) on delete set null,

  -- 記録した時点の練習内容の「控え（スナップショット）」。
  -- 練習予定そのものはコピーせず、あくまで領収書に貼る付箋のような扱いです。
  event_date      date        not null,
  event_slot      text        not null default 'all_day'
                              check (event_slot in ('all_day', 'am', 'pm')),
  event_location  text        not null default '',

  -- ---- 誰が立て替えたか -------------------------------------
  -- 既存の members マスタから選ぶ。マスタに無い人は payer_name に自由記述。
  payer_id        uuid        references public.members (id) on delete set null,
  payer_name      text        not null,

  -- ---- いくら ------------------------------------------------
  -- 円。必ず整数で持ちます（小数は一切使いません）。
  amount          integer     not null check (amount > 0),

  -- ---- 何の立替か -------------------------------------------
  --   club_fee     … 部費立替
  --   prepaid      … プリペイド立替
  --   support_fee  … 後援会費立替
  --   other        … その他（category_other に自由記述）
  category        text        not null
                              check (category in ('club_fee', 'prepaid', 'support_fee', 'other')),
  category_other  text,

  -- ---- 返金の有無と精算状況 ---------------------------------
  -- needs_refund = true  … 本人に返金が必要（例：冨士原さんの印刷代80円）
  -- needs_refund = false … 返金不要（例：会計が部の口座から払ったプール代）
  needs_refund    boolean     not null default true,
  -- status は needs_refund = true のときだけ意味を持ちます
  status          text        not null default 'unsettled'
                              check (status in ('unsettled', 'settled')),
  settled_at      timestamptz,

  memo            text,

  -- ---- 領収書 -----------------------------------------------
  -- receipts バケット内の保存先パス。写真が無い支出もあり得るので null 可。
  receipt_path    text,

  -- 削除は物理削除せず、この印を true にする（既存サイトと同じ流儀）
  is_deleted      boolean     not null default false,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- 「その他」を選んだときは中身の記入を必須にする
  constraint expenses_other_needs_text
    check (category <> 'other' or coalesce(btrim(category_other), '') <> '')
);

create index if not exists expenses_date_idx
  on public.expenses (event_date desc)
  where is_deleted = false;

create index if not exists expenses_assignment_idx
  on public.expenses (assignment_id)
  where is_deleted = false;

create index if not exists expenses_payer_idx
  on public.expenses (payer_id)
  where is_deleted = false;

-- 未精算だけを素早く引くための索引
create index if not exists expenses_unsettled_idx
  on public.expenses (payer_id, event_date)
  where is_deleted = false and needs_refund = true and status = 'unsettled';

-- updated_at の自動更新（関数は既存サイトが作ったものを再利用します）
drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3) RLS（行レベルセキュリティ）
--    ログイン機能を作らない設計なので、既存サイトと同じ守り方にします。
--      ・匿名キー（ブラウザに渡る公開キー）からは何もできない
--      ・読み書きはすべてサーバー側（app/api/...）の
--        service_role キーだけが行う
--    ※ service_role は RLS を通過するので、ポリシーは不要です。
--
--    既存サイトの members / assignments は「匿名でも読める」設定ですが、
--    立替はお金の情報なので、読み取りも匿名には開けません。
-- ------------------------------------------------------------
alter table public.expenses enable row level security;

drop policy if exists expenses_read_all  on public.expenses;
drop policy if exists expenses_write_all on public.expenses;
-- ポリシーを1つも作らない ＝ 匿名キーからは select も insert もできない状態

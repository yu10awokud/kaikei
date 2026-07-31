-- ============================================================
-- プール予約管理アプリ / テーブル定義 (DDL)
--
-- 使い方: Supabase ダッシュボード > SQL Editor に丸ごと貼り付けて Run
-- 何度実行しても同じ結果になるよう drop → create の順に書いています。
-- （※既存データは消えます。運用開始後は実行しないでください）
-- ============================================================

-- gen_random_uuid() を使うための拡張。Supabase では最初から有効なことが多いですが念のため。
create extension if not exists "pgcrypto";

drop table if exists routine_logs cascade;
drop table if exists pool_priorities cascade;
drop table if exists pools cascade;
drop table if exists tasks cascade;
drop table if exists events cascade;

-- ------------------------------------------------------------
-- events: 部の予定（練習 / イベント / オフ）
-- ------------------------------------------------------------
create table events (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  -- check 制約で「決めた3種類以外は入らない」ようにDB側でも守る。
  -- アプリ側のバリデーションが抜けても、変な値が保存されずに済みます。
  type        text not null check (type in ('practice', 'event', 'off')),
  title       text not null,
  start_time  time,
  end_time    time,
  place       text,
  memo        text,
  created_at  timestamptz not null default now()
);

-- 「その月の予定を全部取ってくる」が一番よく走るクエリなので date に索引を張る。
create index events_date_idx on events (date);

-- ------------------------------------------------------------
-- tasks: 手動で登録するタスク
-- ------------------------------------------------------------
create table tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  priority    text not null default 'mid' check (priority in ('high', 'mid', 'low')),
  due_date    date,
  memo        text,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index tasks_done_due_idx on tasks (done, due_date);

-- ------------------------------------------------------------
-- pools: プール施設マスタ
-- ------------------------------------------------------------
create table pools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  method      text not null default 'unknown'
                check (method in ('email', 'phone', 'web', 'counter', 'unknown')),
  contact     text,          -- 電話番号やメールアドレス
  staff_name  text,
  -- 受付開始ルールの種類
  --   months_before : 利用月の rule_value か月前の1日から受付
  --   fixed_day     : 利用月の前月 rule_value 日が申込日・締切日
  --   unknown       : 未調査
  rule_type   text not null default 'unknown'
                check (rule_type in ('months_before', 'fixed_day', 'unknown')),
  rule_value  integer,
  lead_days   integer not null default 7,  -- 受付開始の何日前からTOPに出すか
  manual      text,          -- 手順メモ（引き継ぎ書。改行をそのまま保持）
  active      boolean not null default true
);

-- ------------------------------------------------------------
-- pool_priorities: 曜日 × 季節ごとの優先順位
--
-- start_month > end_month のときは年をまたぐ期間を意味します。
--   例) start_month=9, end_month=4 → 9,10,11,12,1,2,3,4月
-- この判定はアプリ側の isMonthInRange() で行います（lib/date-utils.ts）。
-- ------------------------------------------------------------
create table pool_priorities (
  id           uuid primary key default gen_random_uuid(),
  pool_id      uuid not null references pools(id) on delete cascade,
  weekday      integer not null check (weekday between 0 and 6),  -- 0=日 〜 6=土
  start_month  integer not null check (start_month between 1 and 12),
  end_month    integer not null check (end_month between 1 and 12),
  rank         integer not null default 1,   -- 小さいほど優先。0 は「望み薄だが一応確認」
  unlikely     boolean not null default false,
  note         text
);

create index pool_priorities_weekday_idx on pool_priorities (weekday);
create index pool_priorities_pool_idx on pool_priorities (pool_id);

-- ------------------------------------------------------------
-- routine_logs: 月ごとの予約作業の完了記録
--
-- 「この利用月・この曜日・このプールはもう手を打った」という印。
-- TOP画面はここに記録があるものを要対応リストから除外します。
-- ------------------------------------------------------------
create table routine_logs (
  id            uuid primary key default gen_random_uuid(),
  pool_id       uuid not null references pools(id) on delete cascade,
  target_month  text not null,   -- 'YYYY-MM'（対象となる利用月）
  weekday       integer not null check (weekday between 0 and 6),
  result        text not null check (result in ('booked', 'failed', 'skipped')),
  done_at       timestamptz not null default now(),
  note          text,
  -- 同じ組み合わせで二重に記録されないようにする。
  -- アプリ側では upsert の衝突判定にもこの制約を使っています。
  unique (pool_id, target_month, weekday)
);

create index routine_logs_month_idx on routine_logs (target_month);

-- ============================================================
-- RLS（行レベルセキュリティ）
--
-- Supabase はデフォルトで RLS が有効だと「ポリシーが無い＝全部拒否」になります。
-- このアプリは「閲覧はログイン不要」「編集は合言葉（アプリ側で判定）」という方針なので、
-- anon ロールに読み書きを許可します。
--
-- ※ 注意して読んでください ※
-- anon キーはブラウザに埋め込まれる＝公開情報です。つまり技術的には、
-- URL とキーを知っている人は API を直接叩いてデータを書き換えられます。
-- 個人情報を扱わない前提ならこれで運用できますが、もう一段固めたい場合は
-- このファイル末尾の「セキュリティを強化する場合」を参照してください。
-- ============================================================

alter table events          enable row level security;
alter table tasks           enable row level security;
alter table pools           enable row level security;
alter table pool_priorities enable row level security;
alter table routine_logs    enable row level security;

create policy "anon full access" on events
  for all to anon using (true) with check (true);
create policy "anon full access" on tasks
  for all to anon using (true) with check (true);
create policy "anon full access" on pools
  for all to anon using (true) with check (true);
create policy "anon full access" on pool_priorities
  for all to anon using (true) with check (true);
create policy "anon full access" on routine_logs
  for all to anon using (true) with check (true);

-- ------------------------------------------------------------
-- セキュリティを強化する場合（任意・あとからでOK）
--
-- 下の SQL に差し替えると「anon は読むだけ、書き込みは service_role だけ」になります。
-- あわせて Vercel と .env.local に SUPABASE_SERVICE_ROLE_KEY を追加してください。
-- （Supabase > Project Settings > API Keys > service_role。絶対に公開しないこと）
-- lib/supabase.ts はこの環境変数があれば自動でそちらを使うように書いてあります。
--
--   drop policy "anon full access" on events;
--   create policy "anon read" on events for select to anon using (true);
--   -- 他の4テーブルも同様に
--
-- service_role キーは RLS を素通りするので、追加のポリシーは不要です。
-- ------------------------------------------------------------

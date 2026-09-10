-- ============================================================
-- 立替者（担当者）マスタを、このアプリ専用に切り離すための追加SQL
--
--   これまでは既存サイト（メニュー特戦隊）の members テーブルを
--   そのまま読んでいましたが、
--     ・メニュー担当者のマスタ ≠ 立替者のマスタ
--     ・こちらから直しても既存サイトに影響してはいけない
--   ため、このアプリだけが使う payers テーブルに分けます。
--
--   使い方：Supabase ダッシュボード → SQL Editor に貼り付けて実行。
--   何度実行しても壊れません。
--   ※ 先に migration-expenses.sql を実行しておいてください。
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 0) updated_at を自動更新する関数（このアプリ専用に用意する）
--    既存サイトにも同名の関数がありますが、
--    向こうのものを書き換えないよう、別名で作ります。
-- ------------------------------------------------------------
create or replace function public.expense_app_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 1) payers（立替者マスタ）
--    このアプリの管理画面から自由に追加・削除できます。
-- ------------------------------------------------------------
create table if not exists public.payers (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  -- false にすると、入力画面のプルダウンに出さずに残せる
  is_active   boolean     not null default true,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 同じ名前を二重登録しないように
create unique index if not exists payers_name_key on public.payers (name);
create index if not exists payers_sort_idx on public.payers (sort_order, created_at);

drop trigger if exists payers_set_updated_at on public.payers;
create trigger payers_set_updated_at
  before update on public.payers
  for each row execute function public.expense_app_set_updated_at();

-- ------------------------------------------------------------
-- 2) 最初の中身を用意する
--    まだ 1 件も無いときだけ、既存サイトの部員名を「写して」おきます。
--    一度写したあとは完全に別物で、こちらを直しても
--    既存サイトには一切反映されません（逆も同じです）。
--    不要な人はあとから管理画面で削除してください。
-- ------------------------------------------------------------
insert into public.payers (name, is_active, sort_order)
select m.name, m.is_active, m.sort_order
from public.members m
where not exists (select 1 from public.payers)
on conflict (name) do nothing;

-- ------------------------------------------------------------
-- 3) すでに記録済みの立替の紐付けを、members から payers に付け替える
--    立替者の名前は expenses.payer_name に控えてあるので、
--    名前を手がかりに新しいマスタへ結び直します。
--    見つからない場合は紐付けを外すだけで、記録自体は残ります
--    （画面には payer_name の名前がそのまま出ます）。
-- ------------------------------------------------------------

-- 先に、members を指していた古い制約を外す
alter table public.expenses drop constraint if exists expenses_payer_id_fkey;

update public.expenses e
set payer_id = (select p.id from public.payers p where p.name = e.payer_name)
where e.payer_id is not null
  and not exists (select 1 from public.payers p2 where p2.id = e.payer_id);

-- payers を指す新しい制約を付け直す
-- （立替者を削除しても、立替の記録は消さずに紐付けだけ外す）
alter table public.expenses
  add constraint expenses_payer_id_fkey
  foreign key (payer_id) references public.payers (id) on delete set null;

-- ------------------------------------------------------------
-- 4) RLS（行レベルセキュリティ）
--    expenses と同じ守り方。匿名キーからは読み書きできず、
--    サーバー側（app/api/...）の service_role だけが操作します。
-- ------------------------------------------------------------
alter table public.payers enable row level security;

drop policy if exists payers_read_all  on public.payers;
drop policy if exists payers_write_all on public.payers;
-- ポリシーを1つも作らない ＝ 匿名キーからは何もできない状態

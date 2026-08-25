-- ============================================================
-- メニュー特戦隊 / テーブル定義
-- Supabase の SQL Editor に貼り付けて実行してください。
-- 何度実行しても壊れないように書いてあります（作成済みならスキップ）。
-- ============================================================

-- uuid を自動生成するための拡張
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 共通：updated_at を自動更新する関数
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- members（部員マスタ）
--   引退・卒業しても行は消さず is_active = false にする
-- ------------------------------------------------------------
create table if not exists public.members (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  color       text        not null default '#888888',  -- HEX カラー（例 #E4572E）
  is_active   boolean     not null default true,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 同じ名前の部員を二重登録しないように（CSV取り込みで名前を鍵に使うため）
create unique index if not exists members_name_key on public.members (name);
create index if not exists members_sort_idx on public.members (sort_order, created_at);

drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- places（練習場所マスタ）
-- ------------------------------------------------------------
create table if not exists public.places (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  color       text        not null default '#888888',  -- タグの色（HEX）
  is_active   boolean     not null default true,
  sort_order  integer     not null default 0,
  -- true にすると「オフ（練習なし）」扱い。担当者欄を出さずに表示する
  is_off      boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- すでに places がある環境に後から足す場合の保険
alter table public.places add column if not exists is_off boolean not null default false;

create unique index if not exists places_name_key on public.places (name);
create index if not exists places_sort_idx on public.places (sort_order, created_at);

drop trigger if exists places_set_updated_at on public.places;
create trigger places_set_updated_at
  before update on public.places
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- assignments（担当の割り当て）
--   member_id が NULL ＝「場所だけ決まっていて担当者は未定」＝正常な状態
--   削除は物理削除せず is_deleted = true にする（論理削除）
-- ------------------------------------------------------------
create table if not exists public.assignments (
  id          uuid        primary key default gen_random_uuid(),
  date        date        not null,
  slot        text        not null default 'all_day'
                          check (slot in ('all_day', 'am', 'pm')),
  member_id   uuid        references public.members (id) on delete set null,
  place_id    uuid        references public.places  (id) on delete set null,
  note        text,
  is_deleted  boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 生きているレコードの中では「同じ日・同じ枠」は1件だけ
create unique index if not exists assignments_date_slot_key
  on public.assignments (date, slot)
  where is_deleted = false;

create index if not exists assignments_date_idx
  on public.assignments (date)
  where is_deleted = false;

create index if not exists assignments_member_idx
  on public.assignments (member_id)
  where is_deleted = false;

drop trigger if exists assignments_set_updated_at on public.assignments;
create trigger assignments_set_updated_at
  before update on public.assignments
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 矛盾チェック：同じ日に all_day と am/pm を同居させない
--   （am 1件 + pm 1件 は二部練なので正常）
--   アプリ側でも弾きますが、DB でも最後の砦として守ります。
-- ------------------------------------------------------------
create or replace function public.assignments_check_slot_conflict()
returns trigger
language plpgsql
as $$
begin
  if new.is_deleted then
    return new;
  end if;

  if new.slot = 'all_day' then
    if exists (
      select 1 from public.assignments a
      where a.date = new.date
        and a.is_deleted = false
        and a.id <> new.id
        and a.slot in ('am', 'pm')
    ) then
      raise exception 'SLOT_CONFLICT: % は二部練（午前/午後）で登録済みのため、終日の枠は作れません', new.date;
    end if;
  else
    if exists (
      select 1 from public.assignments a
      where a.date = new.date
        and a.is_deleted = false
        and a.id <> new.id
        and a.slot = 'all_day'
    ) then
      raise exception 'SLOT_CONFLICT: % は終日の枠で登録済みのため、午前/午後の枠は作れません', new.date;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists assignments_slot_conflict on public.assignments;
create trigger assignments_slot_conflict
  before insert or update on public.assignments
  for each row execute function public.assignments_check_slot_conflict();

-- ------------------------------------------------------------
-- RLS（行レベルセキュリティ）
--   ログイン機能を作らないため、匿名キーからは「読み取りのみ」許可。
--   書き込みはサーバー側（Route Handler）のサービスロールキーだけが行う。
--   ※ サービスロールキーは RLS を通過するため、別途ポリシーは不要。
-- ------------------------------------------------------------
alter table public.members     enable row level security;
alter table public.places      enable row level security;
alter table public.assignments enable row level security;

drop policy if exists members_read_all     on public.members;
drop policy if exists places_read_all      on public.places;
drop policy if exists assignments_read_all on public.assignments;

create policy members_read_all     on public.members     for select using (true);
create policy places_read_all      on public.places      for select using (true);
create policy assignments_read_all on public.assignments for select using (true);

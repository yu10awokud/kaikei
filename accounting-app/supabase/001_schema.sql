-- ============================================================
-- 水泳部 会計管理システム / 001 スキーマ・RLS
--   Supabase の SQL Editor に貼り付けて実行してください。
--   何度実行してもエラーにならないように書いてあります。
--
--   ・金額はすべて整数（円）
--   ・残高はテーブルに保存しない（ビューで計算する：003_views.sql）
--   ・取引の物理削除は禁止（トリガーで拒否）。修正は「取消＋再登録」
-- ============================================================

set timezone to 'Asia/Tokyo';

-- ------------------------------------------------------------
-- 安全装置：メニュー特戦隊・立替アプリと同じプロジェクトで実行していないか
--   両アプリにも members テーブルがあり、混ざると壊れるため、
--   会計管理システムは「専用の Supabase プロジェクト」で動かします。
-- ------------------------------------------------------------
do $$ begin
  if to_regclass('public.assignments') is not null or to_regclass('public.places') is not null then
    raise exception 'このプロジェクトにはメニュー特戦隊のテーブル（assignments / places）があります。会計管理システムは新しい Supabase プロジェクトで実行してください。';
  end if;
end $$;

-- ------------------------------------------------------------
-- 列挙型
-- ------------------------------------------------------------
do $$ begin
  create type public.fund_kind as enum ('club_fee', 'prepaid', 'supporters');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.direction_kind as enum ('income', 'expense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_kind as enum ('cash', 'club_bank', 'advance');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_mode_kind as enum ('per_visit', 'monthly');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- allowed_users：ここに登録したメールアドレスだけが読み書きできる
--   画面からは追加できません（SQL Editor で追加してください）
-- ------------------------------------------------------------
create table if not exists public.allowed_users (
  email      text primary key check (email = lower(email)),
  note       text,
  created_at timestamptz not null default now()
);

-- ログイン中のユーザーが allowed_users に入っているか
--   security definer：RLS を通さず allowed_users を直接見る（無限再帰の防止）
create or replace function public.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_allowed_user() from public;
grant execute on function public.is_allowed_user() to anon, authenticated;

-- ------------------------------------------------------------
-- accounts（口座マスタ）：お金が物理的にどこにあるか
-- ------------------------------------------------------------
create table if not exists public.accounts (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  kind       public.account_kind not null,
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- facilities（施設マスタ）
--   per_visit：都度払い ／ monthly：月締め振込
-- ------------------------------------------------------------
create table if not exists public.facilities (
  id           bigint generated always as identity primary key,
  name         text not null unique,
  payment_mode public.payment_mode_kind not null,
  sort_order   int  not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- transaction_types（種別マスタ）
--   code：システムが集計で参照する種別の固定キー（名前を変えても集計が壊れない）
--         利用者が追加した種別は code なし（NULL）
-- ------------------------------------------------------------
create table if not exists public.transaction_types (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  code       text unique,
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- members（部員マスタ・入力補完用）
-- ------------------------------------------------------------
create table if not exists public.members (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- transactions（取引）
-- ------------------------------------------------------------
create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  paid_on      date not null,                       -- お金が動いた日（カード払いは利用日）
  target_month date not null,                       -- 対象月（月初日）。未指定なら paid_on の月（トリガーで補完）
  fund         public.fund_kind not null,
  direction    public.direction_kind not null,
  type_id      bigint not null references public.transaction_types(id),
  amount       int not null check (amount > 0),
  account_id   bigint references public.accounts(id),   -- NULL は「会計間の振替」のみ
  facility_id  bigint references public.facilities(id),
  member_id    bigint references public.members(id),
  description  text,                                -- 摘要
  note         text,                                -- 備考
  group_id     uuid,                                -- 関連する複数行を束ねる
  voided       boolean not null default false,
  void_of      uuid references public.transactions(id),  -- 再登録元（取り消した行）の id
  confirmed_on date,                                -- 確認済み日
  created_by   text default lower(auth.jwt() ->> 'email'),
  created_at   timestamptz not null default now(),
  constraint transactions_target_month_first_day
    check (extract(day from target_month) = 1)
);

create index if not exists transactions_fund_idx         on public.transactions (fund, paid_on, created_at);
create index if not exists transactions_target_month_idx on public.transactions (target_month);
create index if not exists transactions_account_idx      on public.transactions (account_id);
create index if not exists transactions_group_idx        on public.transactions (group_id);
create index if not exists transactions_void_of_idx      on public.transactions (void_of);

-- 登録時の補完と検証
create or replace function public.transactions_before_insert()
returns trigger
language plpgsql
as $$
declare
  type_code text;
begin
  -- 対象月：未指定なら paid_on の月。指定されたら月初日に丸める
  new.target_month := date_trunc('month', coalesce(new.target_month, new.paid_on))::date;

  -- 口座が空欄なのは「振替」のときだけ
  if new.account_id is null then
    select code into type_code from public.transaction_types where id = new.type_id;
    if type_code is distinct from 'transfer' then
      raise exception '口座を空欄にできるのは種別「振替」（会計間の振替）のときだけです'
        using errcode = 'check_violation';
    end if;
  end if;

  -- 新規登録時に取消済み・確認済みの状態で入れることはできない
  new.voided := false;
  return new;
end;
$$;

drop trigger if exists transactions_before_insert on public.transactions;
create trigger transactions_before_insert
  before insert on public.transactions
  for each row execute function public.transactions_before_insert();

-- 更新の制限：変えてよいのは voided（false→true のみ）と confirmed_on だけ
create or replace function public.transactions_before_update()
returns trigger
language plpgsql
as $$
begin
  if old.voided and not new.voided then
    raise exception '取り消した取引を元に戻すことはできません。再登録してください';
  end if;

  if (new.paid_on, new.target_month, new.fund, new.direction, new.type_id, new.amount,
      new.account_id, new.facility_id, new.member_id, new.description, new.note,
      new.group_id, new.void_of, new.created_by, new.created_at, new.id)
     is distinct from
     (old.paid_on, old.target_month, old.fund, old.direction, old.type_id, old.amount,
      old.account_id, old.facility_id, old.member_id, old.description, old.note,
      old.group_id, old.void_of, old.created_by, old.created_at, old.id)
  then
    raise exception '取引の内容は直接変更できません。取り消して再登録してください';
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_before_update on public.transactions;
create trigger transactions_before_update
  before update on public.transactions
  for each row execute function public.transactions_before_update();

-- 物理削除の禁止（service_role からの削除も拒否する）
create or replace function public.transactions_forbid_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception '取引は削除できません。取り消し（voided）を使ってください';
end;
$$;

drop trigger if exists transactions_forbid_delete on public.transactions;
create trigger transactions_forbid_delete
  before delete on public.transactions
  for each row execute function public.transactions_forbid_delete();

-- ------------------------------------------------------------
-- attendance_totals（出席システムの月次合計・手入力）
-- ------------------------------------------------------------
create table if not exists public.attendance_totals (
  id                     bigint generated always as identity primary key,
  target_month           date not null check (extract(day from target_month) = 1),
  facility_id            bigint not null references public.facilities(id),
  member_deduction_total int not null check (member_deduction_total >= 0),
  updated_at             timestamptz not null default now(),
  unique (target_month, facility_id)
);

-- ------------------------------------------------------------
-- cash_checks（月次の現金・通帳照合）
-- ------------------------------------------------------------
create table if not exists public.cash_checks (
  id           bigint generated always as identity primary key,
  checked_on   date not null,
  cash_counted int  not null,
  bank_balance int  not null,
  note         text,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- templates（よく使う会計処理）
--   definition = { "inputs": [...], "rows": [...] }（仕様書 §5）
-- ------------------------------------------------------------
create table if not exists public.templates (
  id         bigint generated always as identity primary key,
  name       text not null,
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  definition jsonb not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- RLS（行レベルセキュリティ）
--   allowed_users に登録された人だけが読み書きできる。
--   未ログイン・未登録の人は 1 行も見えない。
-- ============================================================
alter table public.allowed_users     enable row level security;
alter table public.accounts          enable row level security;
alter table public.facilities        enable row level security;
alter table public.transaction_types enable row level security;
alter table public.members           enable row level security;
alter table public.transactions      enable row level security;
alter table public.attendance_totals enable row level security;
alter table public.cash_checks       enable row level security;
alter table public.templates         enable row level security;

-- allowed_users：閲覧のみ（追加・削除は SQL Editor から）
drop policy if exists allowed_users_select on public.allowed_users;
create policy allowed_users_select on public.allowed_users
  for select to authenticated using (public.is_allowed_user());

-- マスタ・照合・テンプレート：閲覧・追加・更新（削除はしない運用。無効化で対応）
do $$
declare
  t text;
begin
  foreach t in array array['accounts', 'facilities', 'transaction_types', 'members',
                           'attendance_totals', 'cash_checks', 'templates']
  loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_allowed_user())', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_allowed_user())', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user())', t);
  end loop;
end $$;

-- 照合の入力ミスを消せるよう、cash_checks だけは削除も許可
drop policy if exists cash_checks_delete on public.cash_checks;
create policy cash_checks_delete on public.cash_checks
  for delete to authenticated using (public.is_allowed_user());

-- transactions：閲覧・登録・更新（取消・確認済み）のみ。削除ポリシーは作らない
drop policy if exists transactions_select on public.transactions;
drop policy if exists transactions_insert on public.transactions;
drop policy if exists transactions_update on public.transactions;
create policy transactions_select on public.transactions
  for select to authenticated using (public.is_allowed_user());
create policy transactions_insert on public.transactions
  for insert to authenticated with check (public.is_allowed_user());
create policy transactions_update on public.transactions
  for update to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user());

-- anon（未ログイン）には一切の権限を与えない（RLS に加えた二重の守り）
revoke all on public.allowed_users, public.accounts, public.facilities, public.transaction_types,
              public.members, public.transactions, public.attendance_totals, public.cash_checks,
              public.templates
  from anon;

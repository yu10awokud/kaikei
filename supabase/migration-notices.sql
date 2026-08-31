-- ============================================================
-- トップページの「お知らせ」を使うための追加SQL
--   Supabase の SQL Editor に貼り付けて実行してください。
--   何度実行しても壊れません。
-- ============================================================

create table if not exists public.notices (
  id           uuid        primary key default gen_random_uuid(),
  -- 本文（自由記述。改行も入れられる）
  body         text        not null default '',
  -- 表示するかどうか。false にするとトップページから消える（消さずに隠せる）
  is_visible   boolean     not null default true,
  -- 並び順（小さいほど上）
  sort_order   integer     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists notices_order_idx
  on public.notices (sort_order, created_at);

drop trigger if exists notices_set_updated_at on public.notices;
create trigger notices_set_updated_at
  before update on public.notices
  for each row execute function public.set_updated_at();

-- 読み取りのみ匿名キーに許可（書き込みはサーバー側のみ）
alter table public.notices enable row level security;
drop policy if exists notices_read_all on public.notices;
create policy notices_read_all on public.notices for select using (true);

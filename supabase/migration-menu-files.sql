-- ============================================================
-- 練習日ごとの メニューPDF を添付できるようにするための追加SQL
--   Supabase の SQL Editor に貼り付けて実行してください。
--   何度実行しても壊れません。
-- ============================================================

-- ------------------------------------------------------------
-- 1) ファイルの置き場所（ストレージのバケット）を作る
--    menus という名前の入れ物を用意します。
--    公開設定にしているので、URL を知っていれば PDF を開けます
--    （このサイト自体がログイン無しの設計のため、それに合わせています）。
--    ファイル名にはランダムな文字列が入るので、URL を推測されることはありません。
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('menus', 'menus', true)
on conflict (id) do update set public = true;

-- 読み取りは誰でも可。アップロードや削除はサーバー側（service_role）だけが行う
drop policy if exists "menus are readable by everyone" on storage.objects;
create policy "menus are readable by everyone"
  on storage.objects for select
  using (bucket_id = 'menus');

-- ------------------------------------------------------------
-- 2) 添付ファイルの情報を保存するテーブル
-- ------------------------------------------------------------
create table if not exists public.menu_files (
  id            uuid        primary key default gen_random_uuid(),
  -- どの練習日のメニューか
  date          date        not null,
  -- 画面に出すファイル名（アップロード時の名前）
  file_name     text        not null,
  -- ストレージ内の保存先パス
  storage_path  text        not null,
  -- ファイルサイズ（バイト）
  size_bytes    integer     not null default 0,
  -- 任意メモ
  note          text,
  -- 削除は物理削除せず、この印を true にする
  is_deleted    boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists menu_files_date_idx
  on public.menu_files (date)
  where is_deleted = false;

drop trigger if exists menu_files_set_updated_at on public.menu_files;
create trigger menu_files_set_updated_at
  before update on public.menu_files
  for each row execute function public.set_updated_at();

-- 読み取りのみ匿名キーに許可（書き込みはサーバー側のみ）
alter table public.menu_files enable row level security;
drop policy if exists menu_files_read_all on public.menu_files;
create policy menu_files_read_all on public.menu_files for select using (true);

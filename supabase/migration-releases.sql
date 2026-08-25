-- ============================================================
-- バージョン管理（更新履歴）を使うための追加SQL
--   Supabase の SQL Editor に貼り付けて実行してください。
--   何度実行しても壊れません。
-- ============================================================

create table if not exists public.releases (
  id           uuid        primary key default gen_random_uuid(),
  -- 表示するバージョン名（例 v1.2.0）
  version      text        not null,
  -- 公開日
  released_on  date        not null default current_date,
  -- 区分：major = 主要更新 / fix = 修正
  category     text        not null default 'major'
                           check (category in ('major', 'fix')),
  -- アップデート内容。1 行 1 項目として改行で区切って保存する
  notes        text        not null default '',
  -- 担当者（部員マスタとは別に、自由入力）
  author       text        not null default '',
  is_deleted   boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists releases_order_idx
  on public.releases (released_on desc, created_at desc)
  where is_deleted = false;

drop trigger if exists releases_set_updated_at on public.releases;
create trigger releases_set_updated_at
  before update on public.releases
  for each row execute function public.set_updated_at();

-- 読み取りは誰でも可、書き込みはサーバー側（service_role）のみ
alter table public.releases enable row level security;
drop policy if exists releases_read_all on public.releases;
create policy releases_read_all on public.releases for select using (true);

-- 最初の履歴（すでに何か入っていれば追加しません）
insert into public.releases (version, released_on, category, notes, author)
select * from (values
  ('v1.0.0', date '2026-08-25', 'major',
   'Notionから移行して初期リリース' || chr(10) || 'テンプレート・マニュアル・メニュー担当・リンク集を実装',
   '開発チーム'),
  ('v1.0.1', date '2026-08-25', 'major',
   'デザインを刷新（フォント・配色・カレンダー）' || chr(10) || '直近1週間の一覧を追加',
   '開発チーム'),
  ('v1.0.2', date '2026-08-25', 'major',
   'ホーム／マニュアルのタブ構成に変更' || chr(10) || '次回の練習カードを追加' || chr(10) || 'ヘッダーにロゴを設置',
   '開発チーム')
) as v(version, released_on, category, notes, author)
where not exists (select 1 from public.releases);

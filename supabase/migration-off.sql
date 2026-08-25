-- ============================================================
-- 「オフ」を練習場所として選べるようにするための追加SQL
--   ※ すでに schema.sql / seed.sql を実行済みの環境に対して、
--     あとから足すためのファイルです。
--   Supabase の SQL Editor に貼り付けて実行してください。
--   何度実行しても壊れません。
-- ============================================================

-- 1) places に「オフ扱いかどうか」の印を追加
--    true にすると、カレンダー上で担当者欄を出さずに「オフ」と表示します
alter table public.places
  add column if not exists is_off boolean not null default false;

-- 2) 「オフ」を練習場所の一覧に追加（並び順は一番最後）
insert into public.places (name, color, is_active, sort_order, is_off) values
  ('オフ', '#9E9E9E', true, 99, true)
on conflict (name) do update
  set is_off = true,
      color = excluded.color,
      sort_order = excluded.sort_order;

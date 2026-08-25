-- ============================================================
-- メニュー特戦隊 / 初期データ
-- schema.sql を実行したあとに、同じく SQL Editor で実行してください。
-- 何度実行しても同じデータが二重に入らないようにしてあります。
-- ============================================================

-- ------------------------------------------------------------
-- members（部員 12 名）
-- ------------------------------------------------------------
insert into public.members (name, color, is_active, sort_order) values
  ('川村', '#E4572E', true,  1),
  ('小田', '#17BEBB', true,  2),
  ('振原', '#2E86AB', true,  3),
  ('藤井', '#8E44AD', true,  4),
  ('秋山', '#D68910', true,  5),
  ('吉川', '#27AE60', true,  6),
  ('青井', '#3F51B5', true,  7),
  ('山本', '#C0392B', true,  8),
  ('林',   '#6B8E23', true,  9),
  ('田村', '#7F8C8D', true, 10),
  ('野口', '#D81B8C', true, 11),
  ('西川', '#A0522D', true, 12)
on conflict (name) do nothing;

-- ------------------------------------------------------------
-- places（練習場所 3 件）
-- ------------------------------------------------------------
insert into public.places (name, color, is_active, sort_order, is_off) values
  ('イリアス',     '#2E5FA3', true, 1, false),  -- 青系
  ('アクアリーナ', '#4FC3F7', true, 2, false),  -- 水色系
  ('合宿・強化',   '#D64545', true, 3, false),  -- 赤系
  ('オフ',         '#9E9E9E', true, 99, true)   -- 練習なしの日に使う
on conflict (name) do nothing;

-- ------------------------------------------------------------
-- assignments（動作確認用ダミー：2026年7〜8月／10件）
--   ・member_name が NULL の行 ＝「場所は決まったが担当者は未定」
--   ・2026-07-18 は am / pm の2件 ＝ 二部練
--   ※ 本番の過去実績は scripts/import-csv.mjs で CSV から生成します。
-- ------------------------------------------------------------
insert into public.assignments (date, slot, member_id, place_id, note)
select
  v.d::date,
  v.slot,
  (select m.id from public.members m where m.name = v.member_name),
  (select p.id from public.places  p where p.name = v.place_name),
  v.note
from (values
  ('2026-07-04', 'all_day', '川村',       'イリアス',     null),
  ('2026-07-11', 'all_day', '小田',       'アクアリーナ', null),
  ('2026-07-18', 'am',      '振原',       'イリアス',     '二部練の午前'),
  ('2026-07-18', 'pm',      '藤井',       'アクアリーナ', '二部練の午後'),
  ('2026-07-25', 'all_day', null,         'イリアス',     null),
  ('2026-08-01', 'all_day', '秋山',       '合宿・強化',   '夏合宿'),
  ('2026-08-08', 'all_day', '吉川',       'イリアス',     null),
  ('2026-08-15', 'all_day', null,         'アクアリーナ', null),
  ('2026-08-22', 'all_day', '青井',       'イリアス',     null),
  ('2026-08-29', 'all_day', '山本',       'アクアリーナ', null)
) as v(d, slot, member_name, place_name, note)
where not exists (
  select 1 from public.assignments a
  where a.date = v.d::date
    and a.slot = v.slot
    and a.is_deleted = false
);

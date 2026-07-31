-- ============================================================
-- 初期データ投入 (seed)
--
-- schema.sql を実行したあとに、SQL Editor へ貼り付けて Run してください。
-- method / rule_type は 'unknown'、contact と manual は空です。
-- 実際の値は アプリの「プールマスタ」画面から入力していきます。
-- ============================================================

insert into pools (name) values
  ('イリアス'),
  ('京都アクアリーナ（長水路）'),
  ('京都アクアリーナ（短水路）'),
  ('ルネサンス'),
  ('ピノス'),
  ('踏水会'),
  ('アクオン'),
  ('伏見港');

-- ------------------------------------------------------------
-- pool_priorities
--
-- pools.id は uuid の自動採番なので、値を直書きできません。
-- そこで「名前で pools を引いて id を取る」サブクエリを使って挿入します。
-- ------------------------------------------------------------

-- 【火曜 (weekday=2) 通年 1〜12月】
insert into pool_priorities (pool_id, weekday, start_month, end_month, rank, unlikely, note)
select id, 2, 1, 12, 1, false, '取れなければオフ' from pools where name = 'イリアス';

-- 【木曜 (weekday=4) 5〜8月】
insert into pool_priorities (pool_id, weekday, start_month, end_month, rank, unlikely, note)
select id, 4, 5, 8, 1, false, null from pools where name = '京都アクアリーナ（長水路）';
insert into pool_priorities (pool_id, weekday, start_month, end_month, rank, unlikely, note)
select id, 4, 5, 8, 2, false, null from pools where name = 'ルネサンス';

-- 【木曜 (weekday=4) 9〜4月（年またぎ）】
-- start_month(9) > end_month(4) なので 9,10,11,12,1,2,3,4月 を意味します。
insert into pool_priorities (pool_id, weekday, start_month, end_month, rank, unlikely, note)
select id, 4, 9, 4, 1, false, null from pools where name = 'ルネサンス';
insert into pool_priorities (pool_id, weekday, start_month, end_month, rank, unlikely, note)
select id, 4, 9, 4, 2, false, null from pools where name = '京都アクアリーナ（短水路）';

-- 【土曜 (weekday=6) 4〜9月】
insert into pool_priorities (pool_id, weekday, start_month, end_month, rank, unlikely, note)
select id, 6, 4, 9, 1, false, null from pools where name = 'ピノス';
insert into pool_priorities (pool_id, weekday, start_month, end_month, rank, unlikely, note)
select id, 6, 4, 9, 2, false, null from pools where name = '踏水会';
insert into pool_priorities (pool_id, weekday, start_month, end_month, rank, unlikely, note)
select id, 6, 4, 9, 3, false, null from pools where name = 'アクオン';
insert into pool_priorities (pool_id, weekday, start_month, end_month, rank, unlikely, note)
select id, 6, 4, 9, 4, false, null from pools where name = '伏見港';

-- 【土曜 (weekday=6) 10〜3月（年またぎ）】
insert into pool_priorities (pool_id, weekday, start_month, end_month, rank, unlikely, note)
select id, 6, 10, 3, 0, true, '冬期は基本取れない' from pools where name = 'ピノス';
insert into pool_priorities (pool_id, weekday, start_month, end_month, rank, unlikely, note)
select id, 6, 10, 3, 1, false, null from pools where name = '踏水会';
insert into pool_priorities (pool_id, weekday, start_month, end_month, rank, unlikely, note)
select id, 6, 10, 3, 2, false, null from pools where name = 'アクオン';
insert into pool_priorities (pool_id, weekday, start_month, end_month, rank, unlikely, note)
select id, 6, 10, 3, 3, false, null from pools where name = '伏見港';

-- 確認用: 曜日・季節・順位でソートして一覧表示
select p.name, pp.weekday, pp.start_month, pp.end_month, pp.rank, pp.unlikely, pp.note
from pool_priorities pp
join pools p on p.id = pp.pool_id
order by pp.weekday, pp.start_month, pp.rank;

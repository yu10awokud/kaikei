-- ============================================================
-- 水泳部 会計管理システム / 002 初期データ
--   001_schema.sql のあとに実行してください。
--   何度実行しても二重には入りません。
-- ============================================================

-- ------------------------------------------------------------
-- ★ ログインを許可するメールアドレス（Google アカウント）
--   下の 'your-address@gmail.com' を自分のアドレスに書き換えてから実行してください。
--   ・小文字で書いてください
--   ・あとから人を増やすときも、この insert 文を SQL Editor で実行します
-- ------------------------------------------------------------
insert into public.allowed_users (email, note) values
  ('your-address@gmail.com', '会計担当')
on conflict (email) do nothing;

-- ------------------------------------------------------------
-- accounts（口座）
-- ------------------------------------------------------------
insert into public.accounts (name, kind, sort_order) values
  ('現金',             'cash',      1),
  ('部活三井住友',     'club_bank', 2),
  ('立替（会計担当）', 'advance',   3)
on conflict (name) do nothing;

-- ------------------------------------------------------------
-- transaction_types（種別）
--   code は集計で使う固定キーです。名前はマスタ管理画面から変えても大丈夫です。
-- ------------------------------------------------------------
insert into public.transaction_types (name, code, sort_order) values
  ('プリペイド入金', 'prepaid_deposit',     1),
  ('外部参加費',     'external_fee',        2),
  ('プール代',       'pool_fee',            3),
  ('振込手数料',     'bank_fee',            4),
  ('部費徴収',       'club_fee_collection', 5),
  ('経費',           'expense',             6),
  ('後援会費収入',   'supporters_income',   7),
  ('振替',           'transfer',            8),
  ('立替返金',       'advance_repayment',   9),
  ('プリペイド返金', 'prepaid_refund',     10),
  ('繰越',           'carryover',          11),
  ('その他',         'other',              12)
on conflict (name) do nothing;

-- ------------------------------------------------------------
-- facilities（施設）
--   ★ 仮の値です。実際の施設名・支払方法に合わせて、
--     マスタ管理画面（第5段階）または Table Editor で直してください。
-- ------------------------------------------------------------
insert into public.facilities (name, payment_mode, sort_order) values
  ('イリアス',     'per_visit', 1),
  ('アクアリーナ', 'monthly',   2)
on conflict (name) do nothing;

-- ------------------------------------------------------------
-- members（部員）
--   ★ 仮の値です。メニュー特戦隊の部員名を流用しています。
-- ------------------------------------------------------------
insert into public.members (name, sort_order) values
  ('川村', 1), ('小田', 2), ('振原', 3), ('藤井', 4), ('秋山', 5), ('吉川', 6),
  ('青井', 7), ('山本', 8), ('林', 9), ('田村', 10), ('野口', 11), ('西川', 12)
on conflict (name) do nothing;

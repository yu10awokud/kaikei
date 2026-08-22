#!/usr/bin/env node
/**
 * ============================================================
 * CSV → seed.sql 変換スクリプト
 *
 * 使い方（ターミナルで）:
 *   node scripts/import-csv.mjs 過去実績.csv
 *   npm run import-csv -- 過去実績.csv
 *
 * CSV の形式（1 行目は見出し）:
 *   date,slot,member_name,place_name
 *   2025-09-05,all_day,川村,イリアス
 *   2025-09-12,am,小田,アクアリーナ
 *   2025-09-12,pm,,アクアリーナ        ← 担当者未定は空欄でOK
 *   2025-09-19,,藤井,イリアス          ← slot 省略時は all_day 扱い
 *
 * 出力: supabase/seed_assignments.sql
 *   → できあがった SQL を Supabase の SQL Editor に貼って実行します。
 *     部員名・場所名は「名前で引き当て」ます。事前に members / places に
 *     その名前が登録されている必要があります。
 * ============================================================
 */

import fs from 'node:fs';
import path from 'node:path';

const inputPath = process.argv[2] ?? 'scripts/input/assignments.csv';
const outputPath = process.argv[3] ?? 'supabase/seed_assignments.sql';

if (!fs.existsSync(inputPath)) {
  console.error(`❌ CSV が見つかりません: ${inputPath}`);
  console.error('   例: node scripts/import-csv.mjs 過去実績.csv');
  process.exit(1);
}

/** SQL の文字列リテラル用にエスケープ（' を '' にする） */
const quote = (value) => (value === null ? 'null' : `'${String(value).replace(/'/g, "''")}'`);

/** カンマ区切り 1 行を分解する（"..." で囲まれた値にも対応） */
function parseLine(line) {
  const cells = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

const raw = fs.readFileSync(inputPath, 'utf8').replace(/^﻿/, ''); // BOM を除去
const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== '');

if (lines.length < 2) {
  console.error('❌ データ行がありません（1 行目は見出し行として読み飛ばします）。');
  process.exit(1);
}

const header = parseLine(lines[0]).map((h) => h.toLowerCase());
const col = {
  date: header.indexOf('date'),
  slot: header.indexOf('slot'),
  member: header.indexOf('member_name'),
  place: header.indexOf('place_name'),
  note: header.indexOf('note'),
};

if (col.date === -1) {
  console.error('❌ 見出し行に date 列が見つかりません。');
  console.error('   1 行目を  date,slot,member_name,place_name  にしてください。');
  process.exit(1);
}

const rows = [];
const warnings = [];
const seen = new Map(); // 'date' → Set(slot) 重複と矛盾のチェック用

lines.slice(1).forEach((line, i) => {
  const lineNo = i + 2;
  const cells = parseLine(line);
  const pick = (index) => (index >= 0 && cells[index] ? cells[index] : '');

  const date = pick(col.date);
  const slot = pick(col.slot) || 'all_day';
  const member = pick(col.member);
  const place = pick(col.place);
  const note = pick(col.note);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    warnings.push(`${lineNo} 行目: 日付の形式が正しくないため飛ばしました（${date}）`);
    return;
  }
  if (!['all_day', 'am', 'pm'].includes(slot)) {
    warnings.push(`${lineNo} 行目: slot が不正なため飛ばしました（${slot}）`);
    return;
  }
  if (!member && !place) {
    warnings.push(`${lineNo} 行目: 担当者も場所も空のため飛ばしました`);
    return;
  }

  const slots = seen.get(date) ?? new Set();
  if (slots.has(slot)) {
    warnings.push(`${lineNo} 行目: ${date} の ${slot} が重複しているため飛ばしました`);
    return;
  }
  if (slot === 'all_day' && (slots.has('am') || slots.has('pm'))) {
    warnings.push(`${lineNo} 行目: ${date} は午前/午後があるため all_day を飛ばしました`);
    return;
  }
  if (slot !== 'all_day' && slots.has('all_day')) {
    warnings.push(`${lineNo} 行目: ${date} は終日があるため ${slot} を飛ばしました`);
    return;
  }
  slots.add(slot);
  seen.set(date, slots);

  rows.push({ date, slot, member: member || null, place: place || null, note: note || null });
});

const values = rows
  .map((r) => `  (${quote(r.date)}, ${quote(r.slot)}, ${quote(r.member)}, ${quote(r.place)}, ${quote(r.note)})`)
  .join(',\n');

const sql = `-- ============================================================
-- ${path.basename(inputPath)} から自動生成（${new Date().toISOString().slice(0, 10)}）
-- ${rows.length} 件
-- Supabase の SQL Editor に貼り付けて実行してください。
-- 同じ日・同じ枠がすでにある場合は追加しません（何度実行しても安全）。
-- ============================================================

insert into public.assignments (date, slot, member_id, place_id, note)
select
  v.d::date,
  v.slot,
  (select m.id from public.members m where m.name = v.member_name),
  (select p.id from public.places  p where p.name = v.place_name),
  v.note
from (values
${values}
) as v(d, slot, member_name, place_name, note)
where not exists (
  select 1 from public.assignments a
  where a.date = v.d::date
    and a.slot = v.slot
    and a.is_deleted = false
);

-- 名前が members / places に無い場合、担当者・場所は NULL のまま入ります。
-- 取り込み後、下の SQL で確認できます:
--   select date, slot, member_id, place_id from public.assignments
--   where member_id is null and place_id is null;
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, sql, 'utf8');

console.log(`✅ ${rows.length} 件を書き出しました → ${outputPath}`);
if (warnings.length > 0) {
  console.log(`\n⚠️  読み飛ばした行が ${warnings.length} 件あります:`);
  for (const w of warnings.slice(0, 20)) console.log(`   - ${w}`);
  if (warnings.length > 20) console.log(`   … 他 ${warnings.length - 20} 件`);
}
console.log('\n次にやること: 出力された SQL を Supabase の SQL Editor に貼って実行してください。');

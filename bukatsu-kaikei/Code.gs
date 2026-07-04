/**
 * 部活動 会計管理ツール（GAS Webアプリ）
 * --------------------------------------------------
 * プール（施設）ごとに1人あたり料金が異なる部活のプリペイド会計を管理する。
 *
 *  ① 練習日ごとに「使用プール」を設定する
 *  ② その日の出席部員を記録する
 *  ③ 精算：出席者全員のプリペイド残高から、使用プールの1人あたり料金を差し引く
 *  ④ チャージ：誰が・いつ・いくら入金したかを記録し残高に反映する
 *  ⑤ 残高ランキング（富豪 上位3 / 借金 下位3）
 *  ⑥ 出席ランキング（月ごと）
 *
 * 設計方針：
 *  - 残高は保存せず、常に「Σチャージ − Σ支払い」で計算する（整合性のため）。
 *  - 支払い履歴には精算時点の料金を焼き込む（後からマスタを変えても過去は不変）。
 *  - 精算は「精算済フラグ」で二重実行を防止する。
 *  - 引退/現役は表示上のラベルのみ。集計・ランキングは全員を同じ扱いにする。
 *
 * データはこのスクリプトに紐づいたスプレッドシートに保存する。
 * シートが無ければ初回アクセス時に自動生成する。
 */

// ===== シート名・列定義 =====
const SHEET_MEMBERS  = '部員マスタ';
const SHEET_POOLS    = 'プール代マスタ';
const SHEET_SCHEDULE = '練習日程';
const SHEET_ATTEND   = '出席記録';
const SHEET_CHARGE   = '入金記録';
const SHEET_PAYMENT  = '支払い履歴';

// 各シートのヘッダー（列順そのまま）
const HEADERS = {};
HEADERS[SHEET_MEMBERS]  = ['部員ID', '氏名', '学年', '学科', '区分', '状態'];
HEADERS[SHEET_POOLS]    = ['プール名', '料金', 'マネも徴収'];
HEADERS[SHEET_SCHEDULE] = ['日付', '使用プール', '精算済'];
HEADERS[SHEET_ATTEND]   = ['ID', '日付', '部員ID', '出席'];
HEADERS[SHEET_CHARGE]   = ['ID', '日付', '部員ID', '金額', 'メモ'];
HEADERS[SHEET_PAYMENT]  = ['ID', '日付', '部員ID', 'プール名', '金額'];

// 初回のみ投入するサンプルのプール（後から画面で編集可能）
// [プール名, 料金, マネも徴収するか]
const DEFAULT_POOLS = [
  ['市民プール', 300, false],
  ['スイミングスクール', 500, false]
];

// ===== Webアプリのエントリーポイント =====
function doGet() {
  setupSheets_();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('部活会計')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

// CSS/JS を分割して読み込むためのヘルパー
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ===== スプレッドシート初期化 =====
function setupSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(function (name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      const header = HEADERS[name];
      sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
      sheet.setFrozenRows(1);
      // プールマスタだけは初期サンプルを入れておく
      if (name === SHEET_POOLS) {
        sheet.getRange(2, 1, DEFAULT_POOLS.length, 3).setValues(DEFAULT_POOLS);
      }
    }
  });

  // --- 既存シートへの列追加マイグレーション（データは保持したまま列だけ足す） ---
  // プール代マスタに「マネも徴収」列（C列）を後付けする。
  // 既存プールは未入力＝false扱いなので、これまで通りマネは除外される。
  const pools = ss.getSheetByName(SHEET_POOLS);
  if (pools && String(pools.getRange(1, 3).getValue()) !== 'マネも徴収') {
    pools.getRange(1, 3).setValue('マネも徴収').setFontWeight('bold');
  }

  // デフォルトの空シートが残っていれば削除
  const blank = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1) {
    try { ss.deleteSheet(blank); } catch (e) {}
  }
}

// ===== 共通ヘルパー =====
function sheet_(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

// ヘッダーを除いた全データ行を配列で返す（末尾の空行は無視）
function rows_(name) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const width = HEADERS[name].length;
  return sh.getRange(2, 1, last - 1, width).getValues()
    .filter(function (r) { return String(r[0]) !== ''; });
}

// 指定列（1始まり）の値でIDに一致する行番号を返す（見つからなければ-1）
function findRow_(name, col, value) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const vals = sh.getRange(2, col, last - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === String(value)) return i + 2; // 実際の行番号
  }
  return -1;
}

// Date/文字列を 'yyyy-MM-dd' に正規化
function toIso_(value) {
  const tz = Session.getScriptTimeZone();
  if (value instanceof Date) return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  const s = String(value);
  // 'yyyy-MM-dd...' ならそのまま先頭10文字
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return Utilities.formatDate(new Date(s), tz, 'yyyy-MM-dd');
}

function inMonth_(iso, year, month) {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return y === year && m === month;
}

// 部員ID -> 部員オブジェクト のマップ
function memberMap_() {
  const map = {};
  getMembers().forEach(function (m) { map[m.id] = m; });
  return map;
}

// ===== 部員マスタ =====
function getMembers() {
  setupSheets_();
  return rows_(SHEET_MEMBERS).map(function (r) {
    return {
      id:     String(r[0]),
      name:   String(r[1]),
      grade:  String(r[2]),
      dept:   String(r[3]),
      role:   String(r[4]), // プレ / マネ
      status: String(r[5])  // 現役 / 引退（表示ラベルのみ）
    };
  });
}

function saveMember(m) {
  setupSheets_();
  const sh = sheet_(SHEET_MEMBERS);
  const row = [
    m.id || Utilities.getUuid(),
    m.name || '',
    m.grade || '',
    m.dept || '',
    m.role || 'プレ',
    m.status || '現役'
  ];
  if (m.id) {
    const rowIndex = findRow_(SHEET_MEMBERS, 1, m.id);
    if (rowIndex > 0) {
      sh.getRange(rowIndex, 1, 1, row.length).setValues([row]);
      return { ok: true };
    }
  }
  sh.appendRow(row);
  return { ok: true };
}

function deleteMember(id) {
  const rowIndex = findRow_(SHEET_MEMBERS, 1, id);
  if (rowIndex > 0) sheet_(SHEET_MEMBERS).deleteRow(rowIndex);
  return { ok: true };
}

// ===== プール代マスタ =====
function getPools() {
  setupSheets_();
  return rows_(SHEET_POOLS).map(function (r) {
    return {
      name: String(r[0]),
      price: Number(r[1]) || 0,
      chargeMane: r[2] === true || r[2] === 'TRUE' // このプールはマネさんからも徴収するか
    };
  });
}

// プール名をキーに追加/更新（旧名を渡せばリネームも可）
function savePool(p) {
  setupSheets_();
  const sh = sheet_(SHEET_POOLS);
  const key = p.originalName || p.name;
  const row = [p.name, Number(p.price) || 0, !!p.chargeMane];
  const rowIndex = findRow_(SHEET_POOLS, 1, key);
  if (rowIndex > 0) {
    sh.getRange(rowIndex, 1, 1, 3).setValues([row]);
  } else {
    sh.appendRow(row);
  }
  return { ok: true };
}

function deletePool(name) {
  const rowIndex = findRow_(SHEET_POOLS, 1, name);
  if (rowIndex > 0) sheet_(SHEET_POOLS).deleteRow(rowIndex);
  return { ok: true };
}

function pool_(name) {
  const found = getPools().filter(function (p) { return p.name === name; });
  return found.length ? found[0] : null;
}

function poolPrice_(name) {
  const p = pool_(name);
  return p ? p.price : null;
}

// このプールはマネさんも徴収対象か（アクオンのような例外プール用）
function poolChargesMane_(name) {
  const p = pool_(name);
  return p ? p.chargeMane : false;
}

// ===== 練習日程（①使用プールの設定） =====
function getScheduleMonth(year, month) {
  setupSheets_();
  return rows_(SHEET_SCHEDULE)
    .map(function (r) {
      return { date: toIso_(r[0]), pool: String(r[1]), settled: r[2] === true || r[2] === 'TRUE' };
    })
    .filter(function (s) { return inMonth_(s.date, year, month); })
    .sort(function (a, b) { return a.date.localeCompare(b.date); });
}

function scheduleRow_(iso) {
  const sh = sheet_(SHEET_SCHEDULE);
  const last = sh.getLastRow();
  if (last < 2) return null;
  const vals = sh.getRange(2, 1, last - 1, 3).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (toIso_(vals[i][0]) === iso) {
      return { rowIndex: i + 2, pool: String(vals[i][1]), settled: vals[i][2] === true || vals[i][2] === 'TRUE' };
    }
  }
  return null;
}

// 練習日にプールを設定（空文字を渡すと日程を削除）
function saveSchedule(date, poolName) {
  setupSheets_();
  const iso = toIso_(date);
  const sh = sheet_(SHEET_SCHEDULE);
  const existing = scheduleRow_(iso);

  if (existing && existing.settled) {
    return { ok: false, msg: 'この日は精算済みです。変更するには先に精算を取り消してください。' };
  }
  if (!poolName) {
    if (existing) sh.deleteRow(existing.rowIndex);
    return { ok: true };
  }
  if (existing) {
    sh.getRange(existing.rowIndex, 1, 1, 3).setValues([[iso, poolName, false]]);
  } else {
    sh.appendRow([iso, poolName, false]);
  }
  return { ok: true };
}

// ===== 出席記録（②出席） =====
// その日の練習画面に必要な情報（プール・精算済・全部員の出欠）をまとめて返す
function getDay(date) {
  setupSheets_();
  const iso = toIso_(date);
  const sched = scheduleRow_(iso);
  const presentSet = {};
  rows_(SHEET_ATTEND).forEach(function (r) {
    if (toIso_(r[1]) === iso && (r[3] === true || r[3] === 'TRUE')) presentSet[String(r[2])] = true;
  });
  const members = getMembers().map(function (m) {
    return {
      id: m.id, name: m.name, grade: m.grade, dept: m.dept,
      role: m.role, status: m.status, present: !!presentSet[m.id]
    };
  });
  return {
    date: iso,
    pool: sched ? sched.pool : '',
    settled: sched ? sched.settled : false,
    price: sched ? poolPrice_(sched.pool) : null,
    chargeMane: sched ? poolChargesMane_(sched.pool) : false,
    members: members
  };
}

// その日の出席者を上書き保存（presentIds に含まれる部員が出席）
function saveAttendance(date, presentIds) {
  setupSheets_();
  const iso = toIso_(date);
  const sched = scheduleRow_(iso);
  if (sched && sched.settled) {
    return { ok: false, msg: 'この日は精算済みです。変更するには先に精算を取り消してください。' };
  }
  const sh = sheet_(SHEET_ATTEND);
  // 既存のこの日の行を削除（下から）
  const last = sh.getLastRow();
  if (last >= 2) {
    const dates = sh.getRange(2, 2, last - 1, 1).getValues();
    for (let i = dates.length - 1; i >= 0; i--) {
      if (toIso_(dates[i][0]) === iso) sh.deleteRow(i + 2);
    }
  }
  // 出席者を追加
  const ids = presentIds || [];
  if (ids.length) {
    const newRows = ids.map(function (id) { return [Utilities.getUuid(), iso, id, true]; });
    sh.getRange(sh.getLastRow() + 1, 1, newRows.length, 4).setValues(newRows);
  }
  return { ok: true, count: ids.length };
}

function presentIds_(iso) {
  const ids = [];
  rows_(SHEET_ATTEND).forEach(function (r) {
    if (toIso_(r[1]) === iso && (r[3] === true || r[3] === 'TRUE')) ids.push(String(r[2]));
  });
  return ids;
}

// ===== ③精算：出席者全員の残高からプール料金を差し引く =====
function settleDay(date) {
  setupSheets_();
  const iso = toIso_(date);
  const sched = scheduleRow_(iso);
  if (!sched) return { ok: false, msg: 'この日にはプールが設定されていません。' };
  if (sched.settled) return { ok: false, msg: 'この日は既に精算済みです。' };

  const price = poolPrice_(sched.pool);
  if (price == null) return { ok: false, msg: 'プール「' + sched.pool + '」の料金がマスタに登録されていません。' };

  const ids = presentIds_(iso);
  if (ids.length === 0) return { ok: false, msg: 'この日の出席者が記録されていません。' };

  // マネ（マネージャー）は原則プール代がかからないため差引対象から除外する。
  // ただし「マネも徴収」がONのプール（アクオン等）は全員から徴収する。
  // 出席自体は記録されているので、出席ランキングには引き続き計上される。
  const chargeMane = poolChargesMane_(sched.pool);
  const mm = memberMap_();
  const chargeIds = chargeMane
    ? ids
    : ids.filter(function (id) { return !mm[id] || mm[id].role !== 'マネ'; });
  if (chargeIds.length === 0) {
    return { ok: false, msg: '出席者がマネさんのみのため、差引対象がいません。' };
  }

  const pay = sheet_(SHEET_PAYMENT);
  const rows = chargeIds.map(function (id) { return [Utilities.getUuid(), iso, id, sched.pool, price]; });
  pay.getRange(pay.getLastRow() + 1, 1, rows.length, 5).setValues(rows);

  // 精算済フラグを立てる
  sheet_(SHEET_SCHEDULE).getRange(sched.rowIndex, 3).setValue(true);
  const skipped = ids.length - chargeIds.length;
  return { ok: true, count: rows.length, skipped: skipped, price: price, pool: sched.pool };
}

// 精算の取り消し（その日の支払い履歴を削除し、精算済フラグを下ろす）
function unsettleDay(date) {
  setupSheets_();
  const iso = toIso_(date);
  const sh = sheet_(SHEET_PAYMENT);
  const last = sh.getLastRow();
  if (last >= 2) {
    const dates = sh.getRange(2, 2, last - 1, 1).getValues();
    for (let i = dates.length - 1; i >= 0; i--) {
      if (toIso_(dates[i][0]) === iso) sh.deleteRow(i + 2);
    }
  }
  const sched = scheduleRow_(iso);
  if (sched) sheet_(SHEET_SCHEDULE).getRange(sched.rowIndex, 3).setValue(false);
  return { ok: true };
}

// ===== ④チャージ（入金記録） =====
function getCharges(year, month) {
  setupSheets_();
  const mm = memberMap_();
  return rows_(SHEET_CHARGE)
    .map(function (r) {
      const id = String(r[2]);
      return {
        id: String(r[0]),
        date: toIso_(r[1]),
        memberId: id,
        memberName: mm[id] ? mm[id].name : '(削除済み)',
        amount: Number(r[3]) || 0,
        memo: String(r[4] || '')
      };
    })
    .filter(function (c) { return inMonth_(c.date, year, month); })
    .sort(function (a, b) { return b.date.localeCompare(a.date); });
}

function addCharge(c) {
  setupSheets_();
  const row = [
    Utilities.getUuid(),
    toIso_(c.date),
    c.memberId,
    Number(c.amount) || 0,
    c.memo || ''
  ];
  sheet_(SHEET_CHARGE).appendRow(row);
  return { ok: true };
}

function deleteCharge(id) {
  const rowIndex = findRow_(SHEET_CHARGE, 1, id);
  if (rowIndex > 0) sheet_(SHEET_CHARGE).deleteRow(rowIndex);
  return { ok: true };
}

// ===== ⑤残高・ランキング =====
// 全部員の残高 = Σチャージ − Σ支払い
function getBalances() {
  setupSheets_();
  const charged = {}, paid = {};
  rows_(SHEET_CHARGE).forEach(function (r) {
    const id = String(r[2]);
    charged[id] = (charged[id] || 0) + (Number(r[3]) || 0);
  });
  rows_(SHEET_PAYMENT).forEach(function (r) {
    const id = String(r[2]);
    paid[id] = (paid[id] || 0) + (Number(r[4]) || 0);
  });
  return getMembers().map(function (m) {
    const c = charged[m.id] || 0;
    const p = paid[m.id] || 0;
    return {
      id: m.id, name: m.name, grade: m.grade, dept: m.dept,
      role: m.role, status: m.status,
      charged: c, paid: p, balance: c - p
    };
  });
}

// 残高上位3（富豪）・下位3（借金）
function getBalanceRanking() {
  const all = getBalances().sort(function (a, b) { return b.balance - a.balance; });
  return {
    all: all,
    rich: all.slice(0, 3),
    debt: all.slice().reverse().slice(0, 3)
  };
}

// ===== ⑥出席ランキング（月ごと） =====
function getAttendanceRanking(year, month) {
  setupSheets_();
  const count = {};
  rows_(SHEET_ATTEND).forEach(function (r) {
    const iso = toIso_(r[1]);
    const present = (r[3] === true || r[3] === 'TRUE');
    if (present && inMonth_(iso, year, month)) {
      const id = String(r[2]);
      count[id] = (count[id] || 0) + 1;
    }
  });
  // その月の練習日数（分母）
  const total = getScheduleMonth(year, month).length;
  return {
    totalDays: total,
    ranking: getMembers().map(function (m) {
      return { id: m.id, name: m.name, count: count[m.id] || 0 };
    }).sort(function (a, b) { return b.count - a.count; })
  };
}

/**
 * 初期セットアップ用（任意）。スクリプトエディタから実行するとシートを生成し、
 * スプレッドシートのURLをログに出力する。
 */
function init() {
  setupSheets_();
  Logger.log('セットアップ完了: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
}

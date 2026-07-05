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
const SHEET_EXTERNAL = '外部参加記録';
const SHEET_EVENT    = 'イベント';
const SHEET_EVENT_ATTEND = 'イベント参加';
const SHEET_PDFNOTE  = 'PDF備考';

// 各シートのヘッダー（列順そのまま）
const HEADERS = {};
HEADERS[SHEET_MEMBERS]  = ['部員ID', '氏名', '学年', '学科', '区分', '状態'];
HEADERS[SHEET_POOLS]    = ['プール名', '料金', 'マネも徴収'];
HEADERS[SHEET_SCHEDULE] = ['日付', '使用プール', '精算済'];
HEADERS[SHEET_ATTEND]   = ['ID', '日付', '部員ID', '出席'];
HEADERS[SHEET_CHARGE]   = ['ID', '日付', '部員ID', '金額', 'メモ'];
// 「元」= この支払いの出所（'practice:日付' / 'event:イベントID'）。精算取り消しを厳密に紐づけるため。
HEADERS[SHEET_PAYMENT]  = ['ID', '日付', '部員ID', 'プール名', '金額', '元'];
HEADERS[SHEET_EXTERNAL] = ['ID', '日付', '氏名', '所属', '使用プール', '金額', '決済手段', '状態', 'メモ'];
HEADERS[SHEET_EVENT]    = ['ID', '日付', 'イベント名', '用途', '金額', '精算済'];
HEADERS[SHEET_EVENT_ATTEND] = ['ID', 'イベントID', '部員ID'];
HEADERS[SHEET_PDFNOTE]  = ['キー', '値']; // PDF下部のメモ（徴収内容/徴収予定/昨月徴収歴）

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
  // 支払い履歴に「元」列（F列）を後付けする。既存行は空欄＝旧・練習精算として扱う。
  const pay = ss.getSheetByName(SHEET_PAYMENT);
  if (pay && String(pay.getRange(1, 6).getValue()) !== '元') {
    pay.getRange(1, 6).setValue('元').setFontWeight('bold');
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

// 区分が「マネ」かどうかを頑丈に判定する。
// 完全一致に頼らず、前後空白を除いて「マネ」で始まればマネ扱いにする
// （'マネ' / 'マネージャー' / ' マネ ' などの表記ゆれを吸収）。
function isMane_(role) {
  return String(role == null ? '' : role).trim().indexOf('マネ') === 0;
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
      role: m.role, status: m.status, isMane: isMane_(m.role),
      present: !!presentSet[m.id]
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
    : ids.filter(function (id) { return !mm[id] || !isMane_(mm[id].role); });
  if (chargeIds.length === 0) {
    return { ok: false, msg: '出席者がマネさんのみのため、差引対象がいません。' };
  }

  const pay = sheet_(SHEET_PAYMENT);
  const src = 'practice:' + iso;
  const rows = chargeIds.map(function (id) { return [Utilities.getUuid(), iso, id, sched.pool, price, src]; });
  pay.getRange(pay.getLastRow() + 1, 1, rows.length, 6).setValues(rows);

  // 精算済フラグを立てる
  sheet_(SHEET_SCHEDULE).getRange(sched.rowIndex, 3).setValue(true);
  const skipped = ids.length - chargeIds.length;
  return { ok: true, count: rows.length, skipped: skipped, price: price, pool: sched.pool };
}

// 支払い履歴から、指定した「元（出所）」の行を削除する。
// legacyDate を渡すと、元が空欄の旧データはその日付一致で削除する（後方互換）。
function deletePaymentsBySource_(src, legacyDate) {
  const sh = sheet_(SHEET_PAYMENT);
  const last = sh.getLastRow();
  if (last < 2) return;
  const vals = sh.getRange(2, 1, last - 1, 6).getValues(); // A..F
  for (let i = vals.length - 1; i >= 0; i--) {
    const rowSrc = String(vals[i][5] || '');
    const match = rowSrc
      ? (rowSrc === src)
      : (legacyDate && toIso_(vals[i][1]) === legacyDate); // 旧データ（元が空欄）
    if (match) sh.deleteRow(i + 2);
  }
}

// 精算の取り消し（その日の練習精算だけを削除し、精算済フラグを下ろす）
function unsettleDay(date) {
  setupSheets_();
  const iso = toIso_(date);
  deletePaymentsBySource_('practice:' + iso, iso);
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

// ===== 外部参加記録（他大学選手などの立替台帳） =====
// プリペイド残高とは独立した記録。誰にいくら立て替え、回収済みかを管理する。
function getExternals(year, month) {
  setupSheets_();
  const list = rows_(SHEET_EXTERNAL).map(function (r) {
    return {
      id: String(r[0]),
      date: toIso_(r[1]),
      name: String(r[2]),
      org: String(r[3]),
      pool: String(r[4]),
      amount: Number(r[5]) || 0,
      method: String(r[6] || ''),
      status: String(r[7] || '未回収'),
      memo: String(r[8] || '')
    };
  }).filter(function (x) { return inMonth_(x.date, year, month); })
    .sort(function (a, b) { return b.date.localeCompare(a.date); });

  let unpaid = 0, total = 0;
  list.forEach(function (x) { total += x.amount; if (x.status !== '回収済') unpaid += x.amount; });
  return { list: list, unpaidTotal: unpaid, total: total };
}

function addExternal(rec) {
  setupSheets_();
  sheet_(SHEET_EXTERNAL).appendRow([
    Utilities.getUuid(),
    toIso_(rec.date),
    rec.name || '',
    rec.org || '',
    rec.pool || '',
    Number(rec.amount) || 0,
    rec.method || '現金',
    rec.status || '未回収',
    rec.memo || ''
  ]);
  return { ok: true };
}

// 回収状況（未回収 ⇄ 回収済）を切り替える
function toggleExternalPaid(id) {
  const rowIndex = findRow_(SHEET_EXTERNAL, 1, id);
  if (rowIndex > 0) {
    const cell = sheet_(SHEET_EXTERNAL).getRange(rowIndex, 8);
    cell.setValue(String(cell.getValue()) === '回収済' ? '未回収' : '回収済');
  }
  return { ok: true };
}

function deleteExternal(id) {
  const rowIndex = findRow_(SHEET_EXTERNAL, 1, id);
  if (rowIndex > 0) sheet_(SHEET_EXTERNAL).deleteRow(rowIndex);
  return { ok: true };
}

// ===== イベント会計（新歓コンパ・追いコン等） =====
// 徴収はプリペイド残高から差し引く（支払い履歴に 元='event:ID' で記録）。
function getEvents(year, month) {
  setupSheets_();
  // 参加人数をイベントIDごとに集計
  const partCount = {};
  rows_(SHEET_EVENT_ATTEND).forEach(function (r) {
    const eid = String(r[1]);
    partCount[eid] = (partCount[eid] || 0) + 1;
  });
  return rows_(SHEET_EVENT).map(function (r) {
    const id = String(r[0]);
    return {
      id: id,
      date: toIso_(r[1]),
      name: String(r[2]),
      purpose: String(r[3] || ''),
      amount: Number(r[4]) || 0,
      settled: r[5] === true || r[5] === 'TRUE',
      participants: partCount[id] || 0
    };
  }).filter(function (e) { return inMonth_(e.date, year, month); })
    .sort(function (a, b) { return b.date.localeCompare(a.date); });
}

function eventRow_(id) {
  const rowIndex = findRow_(SHEET_EVENT, 1, id);
  if (rowIndex < 0) return null;
  const v = sheet_(SHEET_EVENT).getRange(rowIndex, 1, 1, 6).getValues()[0];
  return {
    rowIndex: rowIndex, id: String(v[0]), date: toIso_(v[1]), name: String(v[2]),
    purpose: String(v[3] || ''), amount: Number(v[4]) || 0,
    settled: v[5] === true || v[5] === 'TRUE'
  };
}

// イベントの新規作成／更新（精算済みは編集不可）
function saveEvent(ev) {
  setupSheets_();
  const sh = sheet_(SHEET_EVENT);
  if (ev.id) {
    const cur = eventRow_(ev.id);
    if (cur && cur.settled) return { ok: false, msg: 'このイベントは精算済みです。編集するには先に精算を取り消してください。' };
    if (cur) {
      sh.getRange(cur.rowIndex, 1, 1, 6).setValues([[
        cur.id, toIso_(ev.date), ev.name || '', ev.purpose || '', Number(ev.amount) || 0, false
      ]]);
      return { ok: true, id: cur.id };
    }
  }
  const id = Utilities.getUuid();
  sh.appendRow([id, toIso_(ev.date), ev.name || '', ev.purpose || '', Number(ev.amount) || 0, false]);
  return { ok: true, id: id };
}

function deleteEvent(id) {
  setupSheets_();
  const cur = eventRow_(id);
  if (cur && cur.settled) return { ok: false, msg: '精算済みのイベントは削除できません。先に精算を取り消してください。' };
  const rowIndex = findRow_(SHEET_EVENT, 1, id);
  if (rowIndex > 0) sheet_(SHEET_EVENT).deleteRow(rowIndex);
  // 参加記録も掃除
  deleteEventParticipants_(id);
  return { ok: true };
}

function deleteEventParticipants_(eventId) {
  const sh = sheet_(SHEET_EVENT_ATTEND);
  const last = sh.getLastRow();
  if (last < 2) return;
  const vals = sh.getRange(2, 2, last - 1, 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0]) === String(eventId)) sh.deleteRow(i + 2);
  }
}

// イベント詳細＋全部員の参加フラグ（新規時はデフォルト全員参加）
function getEventDetail(id) {
  setupSheets_();
  const ev = eventRow_(id);
  if (!ev) return null;
  const partSet = {};
  rows_(SHEET_EVENT_ATTEND).forEach(function (r) {
    if (String(r[1]) === String(id)) partSet[String(r[2])] = true;
  });
  const members = getMembers().map(function (m) {
    return { id: m.id, name: m.name, grade: m.grade, participating: !!partSet[m.id] };
  });
  return {
    id: ev.id, date: ev.date, name: ev.name, purpose: ev.purpose,
    amount: ev.amount, settled: ev.settled, members: members
  };
}

// 参加者を上書き保存（原則全員だが当欠者を外せる）
function saveEventParticipants(eventId, memberIds) {
  setupSheets_();
  const cur = eventRow_(eventId);
  if (cur && cur.settled) return { ok: false, msg: 'このイベントは精算済みです。変更するには先に精算を取り消してください。' };
  deleteEventParticipants_(eventId);
  const ids = memberIds || [];
  if (ids.length) {
    const sh = sheet_(SHEET_EVENT_ATTEND);
    const rows = ids.map(function (mid) { return [Utilities.getUuid(), eventId, mid]; });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
  }
  return { ok: true, count: ids.length };
}

// イベント精算：参加者のプリペイド残高から一律 金額 を差し引く
function settleEvent(id) {
  setupSheets_();
  const ev = eventRow_(id);
  if (!ev) return { ok: false, msg: 'イベントが見つかりません。' };
  if (ev.settled) return { ok: false, msg: 'このイベントは既に精算済みです。' };
  if (!ev.amount || ev.amount <= 0) return { ok: false, msg: '1人あたり金額が設定されていません。' };

  const ids = [];
  rows_(SHEET_EVENT_ATTEND).forEach(function (r) {
    if (String(r[1]) === String(id)) ids.push(String(r[2]));
  });
  if (ids.length === 0) return { ok: false, msg: '参加者が選択されていません。' };

  const pay = sheet_(SHEET_PAYMENT);
  const src = 'event:' + id;
  const label = 'イベント:' + ev.name;
  const rows = ids.map(function (mid) { return [Utilities.getUuid(), ev.date, mid, label, ev.amount, src]; });
  pay.getRange(pay.getLastRow() + 1, 1, rows.length, 6).setValues(rows);

  sheet_(SHEET_EVENT).getRange(ev.rowIndex, 6).setValue(true);
  return { ok: true, count: rows.length, amount: ev.amount };
}

function unsettleEvent(id) {
  setupSheets_();
  deletePaymentsBySource_('event:' + id, null);
  const ev = eventRow_(id);
  if (ev) sheet_(SHEET_EVENT).getRange(ev.rowIndex, 6).setValue(false);
  return { ok: true };
}

// ===== PDF下部メモ（徴収内容/徴収予定/昨月徴収歴）=====
function getPdfNotes() {
  setupSheets_();
  const def = { collected: '', planned: '', history: '' };
  rows_(SHEET_PDFNOTE).forEach(function (r) {
    const k = String(r[0]);
    if (k in def) def[k] = String(r[1] || '');
  });
  return def;
}

function savePdfNotes(notes) {
  setupSheets_();
  const sh = sheet_(SHEET_PDFNOTE);
  const rows = [['キー', '値'],
    ['collected', (notes && notes.collected) || ''],
    ['planned',   (notes && notes.planned)   || ''],
    ['history',   (notes && notes.history)   || '']];
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange(1, 1, 1, 2).setFontWeight('bold');
  return { ok: true };
}

// ===== 残高PDFの発行（配布用の縦長A4レイアウト） =====
// 学年ごとに色分けした残高一覧＋富豪/借金/出席ランキング＋徴収メモを1枚のPDFにする。
function generateBalancePdf(year, month, notes) {
  setupSheets_();
  if (notes) savePdfNotes(notes);
  const memo = getPdfNotes();

  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const y = year || now.getFullYear();
  const m = month || (now.getMonth() + 1);
  const titleDate = Utilities.formatDate(now, tz, 'yyyy年 M月 d日');
  const stamp = Utilities.formatDate(now, tz, 'yyyyMMdd-HHmm');

  const balances = getBalances();

  // 学年ごとの淡い背景色（登場順に割り当て）。金額列は一律ゴールド。
  const gradePalette = ['#f7d4cf', '#fff2cc', '#dce3f7', '#d9ead3', '#cfe0f7', '#fce0cc', '#e8d5f0', '#d5eef0'];
  const goldBg = '#ffd45e';
  const negColor = '#c00000';
  const gradeColor = {};
  let gi = 0;
  balances.forEach(function (mm) {
    const g = mm.grade || '未設定';
    if (!(g in gradeColor)) { gradeColor[g] = gradePalette[gi % gradePalette.length]; gi++; }
  });

  // 学年ごとにまとめて並べる（学年内は登録順を維持）
  const order = [];       // 学年の登場順
  const byGrade = {};
  balances.forEach(function (mm) {
    const g = mm.grade || '未設定';
    if (!byGrade[g]) { byGrade[g] = []; order.push(g); }
    byGrade[g].push(mm);
  });

  let balRows = '';
  order.forEach(function (g, idx) {
    const bg = gradeColor[g];
    byGrade[g].forEach(function (mm, j) {
      const bal = Math.round(mm.balance);
      const col = bal < 0 ? negColor : '#111827';
      // 学年の変わり目に点線区切りを入れる
      const sep = (idx > 0 && j === 0) ? 'border-top:2px dashed #555;' : '';
      balRows +=
        '<tr>' +
          '<td class="nm" style="background:' + bg + ';' + sep + '">' + escHtml_(mm.name) + '</td>' +
          '<td class="am" style="background:' + goldBg + ';color:' + col + ';' + sep + '">' + yen_(bal) + '</td>' +
        '</tr>';
    });
  });

  // 富豪・借金ランキング（上位3／下位3）
  const rk = getBalanceRanking();
  function rankRows(arr, klass) {
    return arr.map(function (mm, i) {
      const bal = Math.round(mm.balance);
      const col = bal < 0 ? negColor : '#111827';
      return '<tr class="' + klass + ' r' + (i + 1) + '">' +
        '<td class="pos">第' + (i + 1) + '位</td>' +
        '<td class="who">' + escHtml_(mm.name) + '</td>' +
        '<td class="amt" style="color:' + col + '">' + yen_(bal) + '</td>' +
      '</tr>';
    }).join('');
  }

  // 月間 出席ランキング（出席回数でティア分け、名前を「・」で連結）
  const att = getAttendanceRanking(y, m);
  const attRows = attendanceTierRows_(att);

  // メモ（改行を <br> に）
  function nl(s) { return escHtml_(s).replace(/\n/g, '<br>'); }

  const html = '' +
  '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
  'body{font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif;color:#111827;margin:26px 30px;}' +
  '.title{text-align:center;font-size:24px;font-weight:800;margin-bottom:2px;}' +
  '.title small{font-size:15px;font-weight:600;margin-left:10px;}' +
  '.layout{width:100%;border-collapse:collapse;}' +
  '.layout>tbody>tr>td{vertical-align:top;}' +
  '.col-left{width:44%;padding-right:24px;}' +
  '.col-right{width:56%;}' +
  'h2{font-size:17px;margin:6px 0 8px;font-weight:800;}' +
  'h3{font-size:15px;margin:20px 0 6px;font-weight:800;}' +
  '.bal{border-collapse:collapse;width:100%;border:2px solid #111;}' +
  '.bal td{padding:5px 10px;font-size:13px;border-right:1px solid #bbb;}' +
  '.bal .nm{text-align:center;width:45%;}' +
  '.bal .am{text-align:right;font-weight:700;border-right:none;}' +
  '.rank{border-collapse:collapse;width:100%;border:2px solid #111;margin-bottom:4px;}' +
  '.rank td{padding:5px 10px;font-size:13px;border:1px solid #999;}' +
  '.rank .pos{text-align:center;width:26%;}' +
  '.rank .who{text-align:center;}' +
  '.rank .amt{text-align:right;font-weight:700;width:34%;}' +
  '.rich .pos{background:#fff27a;} .rich .who,.rich .amt{background:#fbfbc6;}' +
  '.rich.r1 .pos{background:#fff000;} ' +
  '.debt .pos{background:#8c9bb0;color:#fff;} .debt .who,.debt .amt{background:#d3d9e2;}' +
  '.debt.r1 .pos{background:#6f7f96;} ' +
  '.att td{padding:5px 10px;font-size:13px;border:1px solid #7fb4e0;}' +
  '.att .head td{background:#2e8fd6;color:#fff;font-weight:800;text-align:center;}' +
  '.att .pos{text-align:center;width:26%;background:#d3e7f7;}' +
  '.att .who{text-align:center;background:#eaf3fb;}' +
  '.memo{margin-top:22px;font-size:13px;line-height:1.7;}' +
  '.memo .blk{margin-bottom:14px;}' +
  '.memo .lbl{font-weight:800;}' +
  '</style></head><body>' +
  '<div class="title">会計<small>' + titleDate + ' 現在</small></div>' +
  '<table class="layout"><tr>' +
    '<td class="col-left">' +
      '<h2>プリペイド残高 💰</h2>' +
      '<table class="bal">' + balRows + '</table>' +
    '</td>' +
    '<td class="col-right">' +
      '<h3>富豪ランキング 👑</h3>' +
      '<table class="rank">' + rankRows(rk.rich, 'rich') + '</table>' +
      '<h3>借金ランキング ☠️</h3>' +
      '<table class="rank">' + rankRows(rk.debt, 'debt') + '</table>' +
      '<h3>月間 出席ランキング 🏊 <small style="font-weight:600;font-size:12px;">（' + y + '年' + m + '月）</small></h3>' +
      '<table class="rank att">' + attRows + '</table>' +
      '<div class="memo">' +
        '<div class="blk"><span class="lbl">［徴収内容］</span><br>' + nl(memo.collected) + '</div>' +
        '<div class="blk"><span class="lbl">［徴収予定］</span><br>' + nl(memo.planned) + '</div>' +
        '<div class="blk"><span class="lbl">［昨月徴収歴］</span><br>' + nl(memo.history) + '</div>' +
      '</div>' +
    '</td>' +
  '</tr></table>' +
  '</body></html>';

  const pdf = Utilities.newBlob(html, 'text/html', '会計.html')
    .getAs('application/pdf').setName('会計_' + stamp + '.pdf');
  const file = DriveApp.createFile(pdf);
  return { ok: true, url: file.getUrl(), name: file.getName() };
}

// 出席回数でティア分けし、各段の名前を「・」で連結した行HTMLを返す。
// 最上段は全出席なら「全出席」、そうでなければ「第1位」。以降 第2位/第3位…（最大4段）。
function attendanceTierRows_(att) {
  const totalDays = att.totalDays || 0;
  const withCount = (att.ranking || []).filter(function (r) { return r.count > 0; });
  if (withCount.length === 0) {
    return '<tr><td class="pos">—</td><td class="who">出席記録がありません</td></tr>';
  }
  // 出席回数（降順）ごとに氏名をまとめる
  const counts = [];
  const names = {};
  withCount.forEach(function (r) {
    if (!(r.count in names)) { names[r.count] = []; counts.push(r.count); }
    names[r.count].push(r.name);
  });
  counts.sort(function (a, b) { return b - a; });

  let html = '';
  counts.slice(0, 4).forEach(function (c, i) {
    const joined = escHtml_(names[c].join('・'));
    if (i === 0) {
      const label = (totalDays > 0 && c === totalDays) ? '全出席' : '第1位';
      html += '<tr class="head"><td>' + label + '</td><td>' + joined + '</td></tr>';
    } else {
      html += '<tr><td class="pos">第' + (i + 1) + '位</td><td class="who">' + joined + '</td></tr>';
    }
  });
  return html;
}

// PDF用ヘルパー（クライアントには送らないサーバー内整形）
function yen_(n) {
  n = Math.round(Number(n) || 0);
  return (n < 0 ? '-' : '') + '¥' + Math.abs(n).toLocaleString('ja-JP');
}
function escHtml_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/**
 * 初期セットアップ用（任意）。スクリプトエディタから実行するとシートを生成し、
 * スプレッドシートのURLをログに出力する。
 */
function init() {
  setupSheets_();
  Logger.log('セットアップ完了: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
}

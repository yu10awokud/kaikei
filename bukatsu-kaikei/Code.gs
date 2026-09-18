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
// 金額列：個別精算モードで使う1人ごとの徴収額（空欄＝イベントの共通額を使う）
HEADERS[SHEET_EVENT_ATTEND] = ['ID', 'イベントID', '部員ID', '金額'];
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
  // イベント参加に「金額」列（D列）を後付けする。空欄＝イベントの共通額を使う。
  const evAt = ss.getSheetByName(SHEET_EVENT_ATTEND);
  if (evAt && String(evAt.getRange(1, 4).getValue()) !== '金額') {
    evAt.getRange(1, 4).setValue('金額').setFontWeight('bold');
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

// イベント詳細＋全部員の参加フラグ・個別金額（新規時はデフォルト全員参加）
function getEventDetail(id) {
  setupSheets_();
  const ev = eventRow_(id);
  if (!ev) return null;
  const partAmount = {}; // 部員ID -> 個別金額（null=共通額を使う）
  rows_(SHEET_EVENT_ATTEND).forEach(function (r) {
    if (String(r[1]) === String(id)) {
      const a = Number(r[3]);
      partAmount[String(r[2])] = (r[3] !== '' && !isNaN(a) && a > 0) ? a : null;
    }
  });
  const members = getMembers().map(function (m) {
    return {
      id: m.id, name: m.name, grade: m.grade,
      participating: (m.id in partAmount),
      amount: partAmount[m.id] != null ? partAmount[m.id] : null
    };
  });
  return {
    id: ev.id, date: ev.date, name: ev.name, purpose: ev.purpose,
    amount: ev.amount, settled: ev.settled, members: members
  };
}

// 参加者を上書き保存。participants = [{id, amount}]（amountはnull可＝共通額を使う）
function saveEventParticipants(eventId, participants) {
  setupSheets_();
  const cur = eventRow_(eventId);
  if (cur && cur.settled) return { ok: false, msg: 'このイベントは精算済みです。変更するには先に精算を取り消してください。' };
  deleteEventParticipants_(eventId);
  const list = participants || [];
  if (list.length) {
    const sh = sheet_(SHEET_EVENT_ATTEND);
    const rows = list.map(function (p) {
      const a = Number(p.amount);
      return [Utilities.getUuid(), eventId, p.id, (!isNaN(a) && a > 0) ? a : ''];
    });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
  }
  return { ok: true, count: list.length };
}

// イベント精算：参加者ごとに（個別金額があればそれ、なければ共通額を）残高から差し引く
function settleEvent(id) {
  setupSheets_();
  const ev = eventRow_(id);
  if (!ev) return { ok: false, msg: 'イベントが見つかりません。' };
  if (ev.settled) return { ok: false, msg: 'このイベントは既に精算済みです。' };

  const parts = [];
  rows_(SHEET_EVENT_ATTEND).forEach(function (r) {
    if (String(r[1]) === String(id)) {
      const a = Number(r[3]);
      parts.push({ id: String(r[2]), amount: (r[3] !== '' && !isNaN(a) && a > 0) ? a : null });
    }
  });
  if (parts.length === 0) return { ok: false, msg: '参加者が選択されていません。' };

  // 各参加者の徴収額を確定。個別金額がない人は共通額（0円も可）にフォールバックする。
  const mm = memberMap_();
  const missing = [];
  const charges = parts.map(function (p) {
    const amt = p.amount != null ? p.amount : ev.amount;
    if (amt == null || isNaN(amt) || amt < 0) missing.push(mm[p.id] ? mm[p.id].name : p.id);
    return { id: p.id, amount: amt };
  });
  if (missing.length) {
    return { ok: false, msg: '金額が正しくない参加者がいます: ' + missing.join('・') + '\n（個別金額を入力するか、共通の1人あたり金額（0円も可）を設定してください）' };
  }

  // 0円の参加者は差し引かない（支払い履歴に0円の行を残さない）
  const charged = charges.filter(function (c) { return c.amount > 0; });
  if (charged.length === 0) {
    return { ok: false, msg: '全員が0円のため、差し引く金額がありません。' };
  }

  const pay = sheet_(SHEET_PAYMENT);
  const src = 'event:' + id;
  const label = 'イベント:' + ev.name;
  let total = 0;
  const rows = charged.map(function (c) {
    total += c.amount;
    return [Utilities.getUuid(), ev.date, c.id, label, c.amount, src];
  });
  pay.getRange(pay.getLastRow() + 1, 1, rows.length, 6).setValues(rows);

  sheet_(SHEET_EVENT).getRange(ev.rowIndex, 6).setValue(true);
  return { ok: true, count: rows.length, skippedZero: charges.length - charged.length, amount: ev.amount, total: total };
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
  const def = { collected: '', planned: '', history: '', comment: '' };
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
    ['history',   (notes && notes.history)   || ''],
    ['comment',   (notes && notes.comment)   || '']];
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange(1, 1, 1, 2).setFontWeight('bold');
  return { ok: true };
}

// ===== 残高PDFの発行（配布用の縦長A4レイアウト） =====
// GASのHTML→PDF変換は背景色を一切描画できないため、一時シートに描画して
// スプレッドシートのPDFエクスポート機能で出力する（セル背景色が確実に反映される）。
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
  const rk = getBalanceRanking();
  const tiers = attendanceTiers_(getAttendanceRanking(y, m));

  const goldBg = '#ffd45e';
  const negColor = '#c00000';

  // 学年ごとに背景色を割り当て、学年単位でまとめる（学年内は登録順を維持）
  const gradePalette = ['#f7d4cf', '#fff2cc', '#dce3f7', '#d9ead3', '#cfe0f7', '#fce0cc', '#e8d5f0', '#d5eef0'];
  const gradeColor = {};
  const order = [];
  const byGrade = {};
  let gi = 0;
  balances.forEach(function (mm) {
    const g = mm.grade || '未設定';
    if (!(g in gradeColor)) { gradeColor[g] = gradePalette[gi % gradePalette.length]; gi++; order.push(g); byGrade[g] = []; }
    byGrade[g].push(mm);
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.insertSheet('_pdf_' + stamp);
  let lastRow = 1;
  try {
    sh.setColumnWidth(1, 120);  // 左：氏名（広め）
    sh.setColumnWidth(2, 122);  // 左：金額（広め）
    sh.setColumnWidth(3, 20);   // 余白
    sh.setColumnWidth(4, 62);   // 右：順位（狭め）
    sh.setColumnWidth(5, 150);  // 右：氏名（狭め）
    sh.setColumnWidth(6, 86);   // 右：金額（狭め）

    // タイトル
    sh.getRange('A1:F1').merge().setValue('会計　' + titleDate + ' 現在')
      .setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');

    // --- 左：プリペイド残高 ---
    sh.getRange('A3').setValue('プリペイド残高 💰').setFontSize(12).setFontWeight('bold');
    let r = 4;
    order.forEach(function (g, idx) {
      const bg = gradeColor[g];
      byGrade[g].forEach(function (mm, j) {
        const bal = Math.round(mm.balance);
        sh.getRange(r, 1).setValue(mm.name).setBackground(bg).setHorizontalAlignment('center');
        const amt = sh.getRange(r, 2).setValue(yen_(bal)).setBackground(goldBg)
          .setHorizontalAlignment('right');
        if (bal < 0) amt.setFontColor(negColor);
        // 学年の変わり目に点線で区切り
        if (idx > 0 && j === 0) {
          sh.getRange(r, 1, 1, 2).setBorder(true, null, null, null, null, null, '#333', SpreadsheetApp.BorderStyle.DASHED);
        }
        r++;
      });
    });
    const balLast = r - 1;
    if (balLast >= 4) {
      sh.getRange(4, 1, balLast - 3, 2).setBorder(true, true, true, true, false, false, '#111', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    }
    lastRow = Math.max(lastRow, balLast);

    // --- 右：ランキング＋メモ ---
    let rr = 3;
    sh.getRange(rr, 4, 1, 3).merge().setValue('富豪ランキング 👑').setFontSize(12).setFontWeight('bold'); rr++;
    rr = writeRankBlock_(sh, rr, rk.rich, 'rich', negColor); rr++;
    sh.getRange(rr, 4, 1, 3).merge().setValue('借金ランキング ☠️').setFontSize(12).setFontWeight('bold'); rr++;
    rr = writeRankBlock_(sh, rr, rk.debt, 'debt', negColor); rr++;
    sh.getRange(rr, 4, 1, 3).merge().setValue('月間 出席ランキング 🏊（' + y + '年' + m + '月）').setFontSize(12).setFontWeight('bold'); rr++;
    rr = writeAttBlock_(sh, rr, tiers); rr++;

    // メモ（徴収内容／徴収予定／昨月徴収歴）。折り返さず1行ずつ別の行に書く。
    [['［徴収内容］', memo.collected], ['［徴収予定］', memo.planned], ['［昨月徴収歴］', memo.history]].forEach(function (b) {
      sh.getRange(rr, 4, 1, 3).merge().setValue(b[0]).setFontWeight('bold'); rr++;
      const lines = String(b[1] || '').split('\n');
      lines.forEach(function (line) {
        sh.getRange(rr, 4, 1, 3).merge().setValue(line); rr++;
      });
      rr++; // ブロック間の余白
    });
    // コメント（項目名は出さず本文のみ載せる）
    if (memo.comment) {
      String(memo.comment).split('\n').forEach(function (line) {
        sh.getRange(rr, 4, 1, 3).merge().setValue(line).setFontWeight('bold'); rr++;
      });
      rr++;
    }
    lastRow = Math.max(lastRow, rr);

    // フォントを丸ゴシック体（ヒラギノ丸ゴに最も近いGoogle提供フォント）に統一
    sh.getRange(1, 1, lastRow, 6).setFontFamily('M PLUS Rounded 1c');

    SpreadsheetApp.flush();
    const blob = exportSheetAsPdf_(ss, sh, lastRow, '会計_' + stamp);
    const file = DriveApp.createFile(blob);
    // ログイン不要（匿名）アクセスでもPDFを開けるよう、リンクを知っていれば閲覧可にする
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    return { ok: true, url: file.getUrl(), name: file.getName() };
  } finally {
    try { ss.deleteSheet(sh); } catch (e) {}
  }
}

// 富豪/借金ランキングの3行を書き込む。文字は濃色。負の金額は赤字。
function writeRankBlock_(sh, startRow, arr, klass, negColor) {
  let r = startRow;
  arr.forEach(function (mm, i) {
    const bal = Math.round(mm.balance);
    let posBg, cellBg;
    if (klass === 'rich') { posBg = (i === 0) ? '#ffe000' : '#ffe94d'; cellBg = '#fbfbc6'; }
    else                  { posBg = (i === 0) ? '#9aa6b8' : '#b3bccb'; cellBg = '#dde2ea'; }
    sh.getRange(r, 4).setValue('第' + (i + 1) + '位').setBackground(posBg).setHorizontalAlignment('center');
    sh.getRange(r, 5).setValue(mm.name).setBackground(cellBg).setHorizontalAlignment('center');
    const amt = sh.getRange(r, 6).setValue(yen_(bal)).setBackground(cellBg).setHorizontalAlignment('right');
    if (bal < 0) amt.setFontColor(negColor);
    r++;
  });
  if (arr.length) {
    sh.getRange(startRow, 4, arr.length, 3).setBorder(true, true, true, true, true, true, '#666', SpreadsheetApp.BorderStyle.SOLID);
  }
  return r;
}

// 月間出席ランキングのティア行を書き込む。最上段は青ヘッダー、以降は淡青。
// 名前が長い段は折り返さず複数行に分割し、順位ラベルは縦結合する（行の間延び防止）。
function writeAttBlock_(sh, startRow, tiers) {
  const headBg = '#7fb8e6', posBg = '#d3e7f7', whoBg = '#eaf3fb';
  let r = startRow;
  if (tiers.length === 0) {
    sh.getRange(r, 4).setValue('—').setBackground(whoBg).setHorizontalAlignment('center');
    sh.getRange(r, 5, 1, 2).merge().setValue('出席記録がありません').setBackground(whoBg).setHorizontalAlignment('center');
    r++;
  } else {
    tiers.forEach(function (t, i) {
      const lblBg = (i === 0) ? headBg : posBg;
      const nmBg = (i === 0) ? headBg : whoBg;
      const lines = wrapNames_(t.list, 16); // 幅に収まる文字数で改行（折り返さず実際の行に分割）
      const k = lines.length;
      const lbl = (k > 1) ? sh.getRange(r, 4, k, 1).merge() : sh.getRange(r, 4);
      lbl.setValue(t.label).setBackground(lblBg).setHorizontalAlignment('center').setVerticalAlignment('middle');
      lines.forEach(function (line, j) {
        sh.getRange(r + j, 5, 1, 2).merge().setValue(line).setBackground(nmBg).setHorizontalAlignment('center');
      });
      r += k;
    });
  }
  sh.getRange(startRow, 4, r - startRow, 3).setBorder(true, true, true, true, true, true, '#7fb4e0', SpreadsheetApp.BorderStyle.SOLID);
  return r;
}

// 氏名配列を、1行あたり最大 maxChars 文字に収まるよう「・」区切りで複数行に分割する。
function wrapNames_(list, maxChars) {
  const lines = [];
  let cur = '';
  (list || []).forEach(function (n) {
    const piece = cur ? (cur + '・' + n) : n;
    if (cur && piece.length > maxChars) { lines.push(cur); cur = n; }
    else { cur = piece; }
  });
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

// 一時シートを A4縦・幅フィットでPDFエクスポートし、Blobを返す。
function exportSheetAsPdf_(ss, sh, lastRow, name) {
  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export'
    + '?format=pdf&gid=' + sh.getSheetId()
    + '&size=A4&portrait=true&fitw=true&gridlines=false&sheetnames=false'
    + '&printtitle=false&pagenumbers=false&fzr=false'
    + '&top_margin=0.4&bottom_margin=0.4&left_margin=0.4&right_margin=0.4'
    + '&r1=0&c1=0&r2=' + (lastRow + 1) + '&c2=6';
  const resp = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
  return resp.getBlob().setName(name + '.pdf');
}

// 出席回数でティア分けし、各段 {label, names} を返す（最大4段）。
// 最上段は全出席なら「全出席」、そうでなければ「第1位」。以降 第2位/第3位…。
function attendanceTiers_(att) {
  const totalDays = att.totalDays || 0;
  const withCount = (att.ranking || []).filter(function (r) { return r.count > 0; });
  const counts = [];
  const names = {};
  withCount.forEach(function (r) {
    if (!(r.count in names)) { names[r.count] = []; counts.push(r.count); }
    names[r.count].push(r.name);
  });
  counts.sort(function (a, b) { return b - a; });
  return counts.slice(0, 4).map(function (c, i) {
    const label = (i === 0) ? ((totalDays > 0 && c === totalDays) ? '全出席' : '第1位') : ('第' + (i + 1) + '位');
    return { label: label, list: names[c] };
  });
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

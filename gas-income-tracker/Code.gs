/**
 * 収入一括管理ツール（GAS Webアプリ）
 * --------------------------------------------------
 * - 家庭教師（生徒A/B）の勤務記録と収入の自動計算
 * - スイング投資の週単位の損益記録
 * - 今月 / 先月 / 差分（±）をトップ画面に表示
 *
 * データはこのスクリプトに紐づいたスプレッドシートに保存します。
 * シートが無ければ初回アクセス時に自動生成します。
 */

// ===== シート名・定数 =====
const SHEET_SETTINGS = '設定';
const SHEET_TUTOR    = '家庭教師';
const SHEET_SWING    = 'スイング投資';

// 設定のデフォルト値（初回のみ書き込まれる。後から画面で変更可能）
const DEFAULT_SETTINGS = {
  '時給A':   4200,
  '時給B':   3500,
  '生徒A名': '生徒A',
  '生徒B名': '生徒B'
};

// ===== Webアプリのエントリーポイント =====
function doGet() {
  setupSheets_(); // 念のため毎回シートの存在を保証
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('収入管理ツール')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

// HTMLファイルを読み込むためのヘルパー（CSS/JSを分割するため）
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ===== スプレッドシート初期化 =====
function setupSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 設定シート
  let settings = ss.getSheetByName(SHEET_SETTINGS);
  if (!settings) {
    settings = ss.insertSheet(SHEET_SETTINGS);
    settings.getRange(1, 1, 1, 2).setValues([['キー', '値']]).setFontWeight('bold');
    const rows = Object.keys(DEFAULT_SETTINGS).map(k => [k, DEFAULT_SETTINGS[k]]);
    settings.getRange(2, 1, rows.length, 2).setValues(rows);
    settings.setFrozenRows(1);
  }

  // 家庭教師シート
  let tutor = ss.getSheetByName(SHEET_TUTOR);
  if (!tutor) {
    tutor = ss.insertSheet(SHEET_TUTOR);
    tutor.getRange(1, 1, 1, 7)
      .setValues([['ID', '日付', '生徒', '時間', '時給', '金額', 'メモ']])
      .setFontWeight('bold');
    tutor.setFrozenRows(1);
  }

  // スイング投資シート
  let swing = ss.getSheetByName(SHEET_SWING);
  if (!swing) {
    swing = ss.insertSheet(SHEET_SWING);
    swing.getRange(1, 1, 1, 4)
      .setValues([['ID', '日付', '損益', 'メモ']])
      .setFontWeight('bold');
    swing.setFrozenRows(1);
  }

  // デフォルトの「シート1」が残っていれば削除（他に2枚以上ある時のみ）
  const blank = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1) {
    try { ss.deleteSheet(blank); } catch (e) {}
  }
}

// ===== 設定の取得・保存 =====
function getSettings() {
  setupSheets_();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  const values = sheet.getDataRange().getValues();
  const result = Object.assign({}, DEFAULT_SETTINGS);
  for (let i = 1; i < values.length; i++) {
    const key = values[i][0];
    if (key) result[key] = values[i][1];
  }
  // 時給は数値に正規化
  result['時給A'] = Number(result['時給A']) || 0;
  result['時給B'] = Number(result['時給B']) || 0;
  return result;
}

function saveSettings(newSettings) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  const rows = [['キー', '値']];
  ['時給A', '時給B', '生徒A名', '生徒B名'].forEach(k => {
    rows.push([k, newSettings[k]]);
  });
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  return getSettings();
}

// ===== 家庭教師：記録の取得・保存・削除 =====

/**
 * 指定した年月（1〜12）の勤務記録を返す。
 * 同時に、月内の日ごとの合計金額（カレンダー表示用）も返す。
 */
function getTutorRecords(year, month) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TUTOR);
  const values = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  const records = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue;
    const d = new Date(row[1]);
    if (d.getFullYear() !== year || (d.getMonth() + 1) !== month) continue;
    records.push({
      id:      String(row[0]),
      date:    Utilities.formatDate(d, tz, 'yyyy-MM-dd'),
      student: String(row[2]),
      hours:   Number(row[3]),
      rate:    Number(row[4]),
      amount:  Number(row[5]),
      memo:    String(row[6] || '')
    });
  }
  records.sort((a, b) => a.date.localeCompare(b.date));
  return records;
}

/**
 * 勤務記録を1件保存（idが無ければ新規、有れば更新）。
 * 金額は設定の時給を元にサーバー側で再計算する。
 */
function saveTutorRecord(record) {
  const settings = getSettings();
  const rate = record.student === 'A' ? settings['時給A'] : settings['時給B'];
  const hours = Number(record.hours) || 0;
  const amount = Math.round(rate * hours);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TUTOR);
  const newRow = [
    record.id || Utilities.getUuid(),
    record.date,
    record.student,
    hours,
    rate,
    amount,
    record.memo || ''
  ];

  if (record.id) {
    const rowIndex = findRowById_(sheet, record.id);
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
      return { ok: true };
    }
  }
  sheet.appendRow(newRow);
  return { ok: true };
}

function deleteTutorRecord(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TUTOR);
  const rowIndex = findRowById_(sheet, id);
  if (rowIndex > 0) sheet.deleteRow(rowIndex);
  return { ok: true };
}

// ===== スイング投資：記録の取得・保存・削除 =====
function getSwingRecords(year, month) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SWING);
  const values = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  const records = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue;
    const d = new Date(row[1]);
    if (d.getFullYear() !== year || (d.getMonth() + 1) !== month) continue;
    records.push({
      id:     String(row[0]),
      date:   Utilities.formatDate(d, tz, 'yyyy-MM-dd'),
      profit: Number(row[2]),
      memo:   String(row[3] || '')
    });
  }
  records.sort((a, b) => a.date.localeCompare(b.date));
  return records;
}

function saveSwingRecord(record) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SWING);
  const newRow = [
    record.id || Utilities.getUuid(),
    record.date,
    Number(record.profit) || 0,
    record.memo || ''
  ];
  if (record.id) {
    const rowIndex = findRowById_(sheet, record.id);
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
      return { ok: true };
    }
  }
  sheet.appendRow(newRow);
  return { ok: true };
}

function deleteSwingRecord(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SWING);
  const rowIndex = findRowById_(sheet, id);
  if (rowIndex > 0) sheet.deleteRow(rowIndex);
  return { ok: true };
}

// ===== ダッシュボード集計 =====

/**
 * 指定月と前月の収入を集計して返す。
 * 収入 = 家庭教師の合計金額 + スイング投資の損益合計
 */
function getDashboard(year, month) {
  const cur  = monthlyTotal_(year, month);
  const prevDate = new Date(year, month - 2, 1); // monthは1始まりなので-2で前月
  const prev = monthlyTotal_(prevDate.getFullYear(), prevDate.getMonth() + 1);

  return {
    year: year,
    month: month,
    current: cur,
    previous: prev,
    diff: {
      tutor:  cur.tutor  - prev.tutor,
      swing:  cur.swing  - prev.swing,
      total:  cur.total  - prev.total
    }
  };
}

function monthlyTotal_(year, month) {
  const tutorRecords = getTutorRecords(year, month);
  const swingRecords = getSwingRecords(year, month);

  let tutorTotal = 0, hoursA = 0, hoursB = 0;
  tutorRecords.forEach(r => {
    tutorTotal += r.amount;
    if (r.student === 'A') hoursA += r.hours;
    if (r.student === 'B') hoursB += r.hours;
  });

  let swingTotal = 0;
  swingRecords.forEach(r => { swingTotal += r.profit; });

  return {
    tutor:  tutorTotal,
    swing:  swingTotal,
    total:  tutorTotal + swingTotal,
    hoursA: hoursA,
    hoursB: hoursB
  };
}

// ===== 共通ヘルパー =====
function findRowById_(sheet, id) {
  const ids = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  for (let i = 1; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 1; // 1始まりの行番号
  }
  return -1;
}

/**
 * 初期データ確認用（任意）。スクリプトエディタから実行すると
 * シートを生成し、スプレッドシートのURLをログに出します。
 */
function init() {
  setupSheets_();
  Logger.log('セットアップ完了: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
}

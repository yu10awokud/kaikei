/**
 * 水泳練習記録アプリ（GAS Webアプリ）
 * --------------------------------------------------
 * - スマホのブラウザから練習直後にその場で入力するのがメインユースケース
 * - 練習ログ（日付・総距離・メモ）と、その日の複数のタイム記録を保存
 * - 種目マスタ / プールマスタ（アーカイブ方式）
 * - 種目・水路タイプ・期間で絞り込んだタイムの折れ線グラフ分析
 * - 履歴の閲覧・編集・削除
 *
 * データはこのスクリプトに紐づいたスプレッドシートに保存します。
 * シートが無ければ初回アクセス時に自動生成します。
 */

// ===== シート名・定数 =====
const SHEET_PRACTICE = 'PracticeLog';   // 練習ログ
const SHEET_TIME     = 'TimeRecord';    // タイム記録
const SHEET_EVENT    = 'EventMaster';   // 種目マスタ
const SHEET_POOL     = 'PoolMaster';    // プールマスタ
const SHEET_MEET     = 'MeetRecord';    // 試合記録

const STATUS_ACTIVE   = '有効';
const STATUS_ARCHIVED = 'アーカイブ';

// タイム記録の形式。TT（タイムトライアル）のみ分析グラフに反映する。
const TIME_FORMATS = ['TT', 'Short', 'Middle'];
const DEFAULT_FORMAT = 'TT';

// 初回セットアップ時に投入する種目・プールの初期候補
const DEFAULT_EVENTS = ['Fr', 'Ba', 'Br', 'Fly', 'IM'];
const DEFAULT_POOLS  = []; // プールはユーザーに登録してもらう

// ===== Webアプリのエントリーポイント =====
function doGet() {
  setupSheets_(); // 念のため毎回シートの存在を保証
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('水泳練習記録')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

// HTMLファイル内でCSS/JSを読み込むためのヘルパー
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ===== スプレッドシート初期化 =====
function setupSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 練習ログ
  let practice = ss.getSheetByName(SHEET_PRACTICE);
  if (!practice) {
    practice = ss.insertSheet(SHEET_PRACTICE);
    practice.getRange(1, 1, 1, 4)
      .setValues([['ID', '日付', '総距離', 'メモ']])
      .setFontWeight('bold');
    practice.setFrozenRows(1);
  }

  // タイム記録
  let time = ss.getSheetByName(SHEET_TIME);
  if (!time) {
    time = ss.insertSheet(SHEET_TIME);
    time.getRange(1, 1, 1, 8)
      .setValues([['ID', '練習ログID', '日付', '種目', '距離', 'タイム(秒)', 'プール', '形式']])
      .setFontWeight('bold');
    time.setFrozenRows(1);
  } else if (String(time.getRange(1, 8).getValue()) !== '形式') {
    // 既存シートに「形式」列が無ければ追加（旧データは TT 扱い）
    time.getRange(1, 8).setValue('形式').setFontWeight('bold');
  }

  // 種目マスタ
  let event = ss.getSheetByName(SHEET_EVENT);
  if (!event) {
    event = ss.insertSheet(SHEET_EVENT);
    event.getRange(1, 1, 1, 3)
      .setValues([['ID', '種目名', '状態']])
      .setFontWeight('bold');
    event.setFrozenRows(1);
    if (DEFAULT_EVENTS.length) {
      const rows = DEFAULT_EVENTS.map(name => [Utilities.getUuid(), name, STATUS_ACTIVE]);
      event.getRange(2, 1, rows.length, 3).setValues(rows);
    }
  }

  // プールマスタ
  let pool = ss.getSheetByName(SHEET_POOL);
  if (!pool) {
    pool = ss.insertSheet(SHEET_POOL);
    pool.getRange(1, 1, 1, 4)
      .setValues([['ID', 'プール名', '水路タイプ', '状態']])
      .setFontWeight('bold');
    pool.setFrozenRows(1);
    if (DEFAULT_POOLS.length) {
      const rows = DEFAULT_POOLS.map(p => [Utilities.getUuid(), p.name, p.lane, STATUS_ACTIVE]);
      pool.getRange(2, 1, rows.length, 4).setValues(rows);
    }
  }

  // 試合記録
  let meet = ss.getSheetByName(SHEET_MEET);
  if (!meet) {
    meet = ss.insertSheet(SHEET_MEET);
    meet.getRange(1, 1, 1, 7)
      .setValues([['ID', '大会名', '日付', '水路タイプ', '種目', '距離', 'タイム(秒)']])
      .setFontWeight('bold');
    meet.setFrozenRows(1);
  }

  // デフォルトの空シートが残っていれば削除
  const blank = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1) {
    try { ss.deleteSheet(blank); } catch (e) {}
  }
}

// ===== タイム変換ヘルパー =====

/**
 * 分秒形式の文字列を秒数(number)に変換する。
 *   "1:19.50" -> 79.5
 *   "1:05"    -> 65
 *   "30.20"   -> 30.2
 *   "45"      -> 45
 * 不正な入力は例外を投げる。
 */
function parseTimeToSeconds_(input) {
  if (input === null || input === undefined) throw new Error('タイムが未入力です');
  const s = String(input).trim();
  if (s === '') throw new Error('タイムが未入力です');

  // 数値としてそのまま渡ってきた場合（既に秒数）
  if (/^\d+(\.\d+)?$/.test(s)) {
    const v = Number(s);
    if (v < 0) throw new Error('タイムは0以上で入力してください');
    return Math.round(v * 100) / 100;
  }

  // 分:秒(.ミリ秒) 形式
  const m = s.match(/^(\d+):([0-5]?\d)(\.\d+)?$/);
  if (!m) {
    throw new Error('タイムの形式が不正です（例: 1:19.50 または 30.20）');
  }
  const minutes = parseInt(m[1], 10);
  const seconds = parseInt(m[2], 10);
  const frac = m[3] ? parseFloat(m[3]) : 0;
  const total = minutes * 60 + seconds + frac;
  return Math.round(total * 100) / 100;
}

/**
 * 秒数を "m:ss.SS" 形式に整形する（1分以上なら分表記、未満なら秒のみ）。
 *   79.5 -> "1:19.50"
 *   30.2 -> "30.20"
 */
function formatSeconds_(sec) {
  const v = Number(sec) || 0;
  if (v >= 60) {
    const m = Math.floor(v / 60);
    const s = v - m * 60;
    const sStr = s.toFixed(2).padStart(5, '0'); // "09.50"
    return m + ':' + sStr;
  }
  return v.toFixed(2);
}

// ===== 種目マスタ =====
function getEvents(includeArchived) {
  setupSheets_();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EVENT);
  const values = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue;
    const status = String(row[2] || STATUS_ACTIVE);
    if (!includeArchived && status !== STATUS_ACTIVE) continue;
    result.push({ id: String(row[0]), name: String(row[1]), status: status });
  }
  return result;
}

function addEvent(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('種目名を入力してください');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EVENT);
  // 既存の有効な同名があれば重複追加しない
  const existing = getEvents(false);
  if (existing.some(e => e.name === trimmed)) {
    throw new Error('同じ名前の種目が既に存在します');
  }
  sheet.appendRow([Utilities.getUuid(), trimmed, STATUS_ACTIVE]);
  return getEvents(false);
}

function archiveEvent(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EVENT);
  const rowIndex = findRowById_(sheet, id);
  if (rowIndex > 0) sheet.getRange(rowIndex, 3).setValue(STATUS_ARCHIVED);
  return getEvents(false);
}

// ===== プールマスタ =====
function getPools(includeArchived) {
  setupSheets_();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_POOL);
  const values = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue;
    const status = String(row[3] || STATUS_ACTIVE);
    if (!includeArchived && status !== STATUS_ACTIVE) continue;
    result.push({
      id: String(row[0]),
      name: String(row[1]),
      lane: String(row[2] || ''),
      status: status
    });
  }
  return result;
}

function addPool(name, lane) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('プール名を入力してください');
  if (lane !== '長水路' && lane !== '短水路') {
    throw new Error('水路タイプを選択してください');
  }
  const existing = getPools(false);
  if (existing.some(p => p.name === trimmed)) {
    throw new Error('同じ名前のプールが既に存在します');
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_POOL);
  sheet.appendRow([Utilities.getUuid(), trimmed, lane, STATUS_ACTIVE]);
  return getPools(false);
}

function archivePool(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_POOL);
  const rowIndex = findRowById_(sheet, id);
  if (rowIndex > 0) sheet.getRange(rowIndex, 4).setValue(STATUS_ARCHIVED);
  return getPools(false);
}

/** プール名 -> 水路タイプ のマップを作る（アーカイブ含む＝過去データ用） */
function poolLaneMap_() {
  const map = {};
  getPools(true).forEach(p => { map[p.name] = p.lane; });
  return map;
}

// ===== 練習記録：保存 =====

/**
 * 練習ログ＋タイム記録をまとめて保存する。
 * payload = {
 *   id:       更新時のみ（練習ログID）,
 *   date:     'yyyy-MM-dd',
 *   distance: 総距離(number),
 *   memo:     メモ,
 *   times: [ { event, distance, time, pool }, ... ]   // time は "1:19.50" 等の文字列
 * }
 * タイムはサーバー側で秒数に変換して保存する。
 */
function savePractice(payload) {
  setupSheets_();
  if (!payload || !payload.date) throw new Error('日付を入力してください');

  // タイム記録を事前に検証・変換（1件でも不正なら保存しない）
  const times = (payload.times || []).map(function (t) {
    let format = String(t.format || DEFAULT_FORMAT);
    if (TIME_FORMATS.indexOf(format) < 0) format = DEFAULT_FORMAT;
    return {
      event: String(t.event || '').trim(),
      distance: Number(t.distance) || 0,
      seconds: parseTimeToSeconds_(t.time),
      pool: String(t.pool || '').trim(),
      format: format
    };
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const practiceSheet = ss.getSheetByName(SHEET_PRACTICE);
  const timeSheet = ss.getSheetByName(SHEET_TIME);

  const logId = payload.id || Utilities.getUuid();
  const distance = Number(payload.distance) || 0;
  const memo = String(payload.memo || '');
  const logRow = [logId, payload.date, distance, memo];

  if (payload.id) {
    // 更新：練習ログ行を書き換え、既存のタイム記録を全削除して入れ直す
    const rowIndex = findRowById_(practiceSheet, payload.id);
    if (rowIndex > 0) {
      practiceSheet.getRange(rowIndex, 1, 1, 4).setValues([logRow]);
    } else {
      practiceSheet.appendRow(logRow);
    }
    deleteTimeRecordsByLogId_(logId);
  } else {
    practiceSheet.appendRow(logRow);
  }

  // タイム記録を追加
  if (times.length) {
    const rows = times.map(function (t) {
      return [Utilities.getUuid(), logId, payload.date, t.event, t.distance, t.seconds, t.pool, t.format];
    });
    timeSheet.getRange(timeSheet.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
  }

  return { ok: true, id: logId };
}

// ===== 練習記録：履歴取得 =====

/**
 * 練習ログを日付の新しい順で返す（各ログにタイム記録をぶら下げる）。
 * eventFilter を渡すと、その種目を含む練習日のみに絞り込む。
 */
function getHistory(eventFilter) {
  setupSheets_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();

  // タイム記録を logId 単位でまとめる
  const timeValues = ss.getSheetByName(SHEET_TIME).getDataRange().getValues();
  const timesByLog = {};
  for (let i = 1; i < timeValues.length; i++) {
    const row = timeValues[i];
    if (!row[0]) continue;
    const logId = String(row[1]);
    if (!timesByLog[logId]) timesByLog[logId] = [];
    timesByLog[logId].push({
      id: String(row[0]),
      logId: logId,
      date: fmtDate_(row[2], tz),
      event: String(row[3]),
      distance: Number(row[4]),
      seconds: Number(row[5]),
      timeText: formatSeconds_(Number(row[5])),
      pool: String(row[6] || ''),
      format: String(row[7] || DEFAULT_FORMAT)
    });
  }

  // 練習ログ
  const logValues = ss.getSheetByName(SHEET_PRACTICE).getDataRange().getValues();
  const logs = [];
  for (let i = 1; i < logValues.length; i++) {
    const row = logValues[i];
    if (!row[0]) continue;
    const logId = String(row[0]);
    const times = timesByLog[logId] || [];
    if (eventFilter && !times.some(t => t.event === eventFilter)) continue;
    logs.push({
      id: logId,
      date: fmtDate_(row[1], tz),
      distance: Number(row[2]) || 0,
      memo: String(row[3] || ''),
      times: times
    });
  }

  logs.sort((a, b) => b.date.localeCompare(a.date));
  return logs;
}

// ===== 練習記録：削除 =====
function deletePractice(logId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const practiceSheet = ss.getSheetByName(SHEET_PRACTICE);
  const rowIndex = findRowById_(practiceSheet, logId);
  if (rowIndex > 0) practiceSheet.deleteRow(rowIndex);
  deleteTimeRecordsByLogId_(logId);
  return { ok: true };
}

function deleteTimeRecord(timeId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TIME);
  const rowIndex = findRowById_(sheet, timeId);
  if (rowIndex > 0) sheet.deleteRow(rowIndex);
  return { ok: true };
}

/** 指定 logId に紐づくタイム記録を全削除（下の行から消して行ズレを防ぐ） */
function deleteTimeRecordsByLogId_(logId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TIME);
  const values = sheet.getDataRange().getValues();
  const rowsToDelete = [];
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1]) === String(logId)) rowsToDelete.push(i + 1);
  }
  rowsToDelete.sort((a, b) => b - a).forEach(r => sheet.deleteRow(r));
}

// ===== 分析データ =====

/** 期間指定（week/month/3month/all）から下限日付文字列を求める。all等はnull。 */
function periodMinDate_(period, tz) {
  const days = { week: 7, month: 30, '3month': 90 };
  if (!days[period]) return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days[period]);
  return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}

/**
 * 種目・水路タイプ・期間で絞り込んだタイムを日付昇順で返す。
 * 練習（TT）と試合記録の両方を返す。
 *   { practice: [...], meet: [...] }
 * laneType : '長水路' | '短水路' | '両方'
 * period   : 'week'(7日) | 'month'(30日) | '3month'(90日) | 'all'
 */
function getAnalysisData(eventName, laneType, period) {
  setupSheets_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const laneMap = poolLaneMap_();
  const minDate = periodMinDate_(period, tz);

  // ---- 練習タイム（TTのみ） ----
  const timeValues = ss.getSheetByName(SHEET_TIME).getDataRange().getValues();
  const practice = [];
  for (let i = 1; i < timeValues.length; i++) {
    const row = timeValues[i];
    if (!row[0]) continue;
    if (String(row[3]) !== eventName) continue;

    // 分析には TT（タイムトライアル）の記録のみ反映する（旧データは TT 扱い）
    const format = String(row[7] || DEFAULT_FORMAT);
    if (format !== 'TT') continue;

    const dateStr = fmtDate_(row[2], tz);
    if (minDate && dateStr < minDate) continue;

    const pool = String(row[6] || '');
    const lane = laneMap[pool] || '';
    if (laneType !== '両方' && lane !== laneType) continue;

    practice.push({
      date: dateStr,
      distance: Number(row[4]),
      seconds: Number(row[5]),
      timeText: formatSeconds_(Number(row[5])),
      pool: pool,
      lane: lane
    });
  }
  practice.sort((a, b) => a.date.localeCompare(b.date));

  // ---- 試合タイム ----
  const meetValues = ss.getSheetByName(SHEET_MEET).getDataRange().getValues();
  const meet = [];
  for (let i = 1; i < meetValues.length; i++) {
    const row = meetValues[i];
    if (!row[0]) continue;
    if (String(row[4]) !== eventName) continue;

    const dateStr = fmtDate_(row[2], tz);
    if (minDate && dateStr < minDate) continue;

    const lane = String(row[3] || '');
    if (laneType !== '両方' && lane !== laneType) continue;

    meet.push({
      date: dateStr,
      meetName: String(row[1] || ''),
      distance: Number(row[5]),
      seconds: Number(row[6]),
      timeText: formatSeconds_(Number(row[6])),
      lane: lane
    });
  }
  meet.sort((a, b) => a.date.localeCompare(b.date));

  return { practice: practice, meet: meet };
}

/**
 * 期間内の総距離の推移を返す（同一日は合計）。日付昇順。
 *   [ { date, distance }, ... ]
 */
function getDistanceTrend(period) {
  setupSheets_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const minDate = periodMinDate_(period, tz);

  const values = ss.getSheetByName(SHEET_PRACTICE).getDataRange().getValues();
  const byDate = {};
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue;
    const dateStr = fmtDate_(row[1], tz);
    if (minDate && dateStr < minDate) continue;
    byDate[dateStr] = (byDate[dateStr] || 0) + (Number(row[2]) || 0);
  }
  return Object.keys(byDate).sort().map(function (d) {
    return { date: d, distance: byDate[d] };
  });
}

// ===== 試合記録 =====

/** 試合記録を日付の新しい順で返す */
function getMeetRecords() {
  setupSheets_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const values = ss.getSheetByName(SHEET_MEET).getDataRange().getValues();
  const records = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue;
    records.push({
      id: String(row[0]),
      meetName: String(row[1] || ''),
      date: fmtDate_(row[2], tz),
      lane: String(row[3] || ''),
      event: String(row[4] || ''),
      distance: Number(row[5]) || 0,
      seconds: Number(row[6]) || 0,
      timeText: formatSeconds_(Number(row[6]) || 0)
    });
  }
  records.sort((a, b) => b.date.localeCompare(a.date));
  return records;
}

/**
 * 試合記録を保存（id無しで新規、有りで更新）。
 * payload = { id?, meetName, date, lane, event, distance, time }
 */
function saveMeetRecord(payload) {
  setupSheets_();
  if (!payload || !payload.date) throw new Error('日付を入力してください');
  if (!String(payload.meetName || '').trim()) throw new Error('大会名を入力してください');
  if (payload.lane !== '長水路' && payload.lane !== '短水路') {
    throw new Error('水路タイプを選択してください');
  }
  if (!String(payload.event || '').trim()) throw new Error('種目を選択してください');
  const seconds = parseTimeToSeconds_(payload.time);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MEET);
  const id = payload.id || Utilities.getUuid();
  const row = [
    id,
    String(payload.meetName).trim(),
    payload.date,
    payload.lane,
    String(payload.event).trim(),
    Number(payload.distance) || 0,
    seconds
  ];
  if (payload.id) {
    const rowIndex = findRowById_(sheet, payload.id);
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, 7).setValues([row]);
      return { ok: true, id: id };
    }
  }
  sheet.appendRow(row);
  return { ok: true, id: id };
}

function deleteMeetRecord(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MEET);
  const rowIndex = findRowById_(sheet, id);
  if (rowIndex > 0) sheet.deleteRow(rowIndex);
  return { ok: true };
}

// ===== 初期表示用のまとめ取得 =====
/** 入力画面の初期化に必要なマスタをまとめて返す（往復を減らす） */
function getMasters() {
  return {
    events: getEvents(false),
    pools: getPools(false)
  };
}

// ===== 共通ヘルパー =====
function findRowById_(sheet, id) {
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const ids = sheet.getRange(1, 1, last, 1).getValues();
  for (let i = 1; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

/** セル値（Date または文字列）を 'yyyy-MM-dd' に整形 */
function fmtDate_(value, tz) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  }
  // 文字列の場合はそのまま先頭10文字（'yyyy-MM-dd'想定）
  const s = String(value);
  return s.length >= 10 ? s.substring(0, 10) : s;
}

/**
 * スクリプトエディタから手動実行してセットアップ確認用。
 */
function init() {
  setupSheets_();
  Logger.log('セットアップ完了: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
}

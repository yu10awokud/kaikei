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
const SHEET_RACE     = 'RaceCounter';   // 大会カウントダウン

const STATUS_ACTIVE   = '有効';
const STATUS_ARCHIVED = 'アーカイブ';

// タイム記録の形式。TT（タイムトライアル）のみ分析グラフに反映する。
const TIME_FORMATS = ['TT', 'Short', 'Middle'];
const DEFAULT_FORMAT = 'TT';

// 試合記録の種別（正式記録 / 引継ぎ）
const MEET_KINDS = ['正式', '引継ぎ'];
const DEFAULT_MEET_KIND = '正式';

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
    time.getRange(1, 1, 1, 9)
      .setValues([['ID', '練習ログID', '日付', '種目', '距離', 'タイム(秒)', 'プール', '形式', 'ラップ']])
      .setFontWeight('bold');
    time.setFrozenRows(1);
  } else {
    // 既存シートに列が無ければ追加（旧データは TT 扱い・ラップ無し）
    if (String(time.getRange(1, 8).getValue()) !== '形式') {
      time.getRange(1, 8).setValue('形式').setFontWeight('bold');
    }
    if (String(time.getRange(1, 9).getValue()) !== 'ラップ') {
      time.getRange(1, 9).setValue('ラップ').setFontWeight('bold');
    }
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
    meet.getRange(1, 1, 1, 8)
      .setValues([['ID', '大会名', '日付', '水路タイプ', '種目', '距離', 'タイム(秒)', '種別']])
      .setFontWeight('bold');
    meet.setFrozenRows(1);
  } else if (String(meet.getRange(1, 8).getValue()) !== '種別') {
    // 既存シートに「種別」列が無ければ追加（旧データは正式扱い）
    meet.getRange(1, 8).setValue('種別').setFontWeight('bold');
  }

  // 大会カウントダウン
  let race = ss.getSheetByName(SHEET_RACE);
  if (!race) {
    race = ss.insertSheet(SHEET_RACE);
    race.getRange(1, 1, 1, 3)
      .setValues([['ID', '大会名', '日付']])
      .setFontWeight('bold');
    race.setFrozenRows(1);
  }

  // デフォルトの空シートが残っていれば削除
  const blank = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1) {
    try { ss.deleteSheet(blank); } catch (e) {}
  }
}

// ===== タイム変換ヘルパー =====

/**
 * タイム文字列を秒数(number)に変換する。
 * スマホのテンキーで入力しやすいドット区切りを主形式とする。
 *   "1.23.45" -> 83.45   （分.秒.小数）
 *   "30.20"   -> 30.2    （秒.小数、1分未満）
 *   "45"      -> 45
 *   "1:19.50" -> 79.5    （コロン形式もPC入力互換で受け付ける）
 * 不正な入力は例外を投げる。
 */
function parseTimeToSeconds_(input) {
  if (input === null || input === undefined) throw new Error('タイムが未入力です');
  const s = String(input).trim();
  if (s === '') throw new Error('タイムが未入力です');
  const fmtErr = 'タイムの形式が不正です（例: 1.23.45 または 30.20）';

  // コロン形式（PC入力互換）: M:SS(.hh)
  const c = s.match(/^(\d+):([0-5]?\d)(\.\d+)?$/);
  if (c) {
    const total = parseInt(c[1], 10) * 60 + parseInt(c[2], 10) + (c[3] ? parseFloat(c[3]) : 0);
    return Math.round(total * 100) / 100;
  }

  // ドット形式
  const parts = s.split('.');
  if (parts.length === 1) {
    if (!/^\d+$/.test(parts[0])) throw new Error(fmtErr);
    return Number(parts[0]);
  }
  if (parts.length === 2) {
    // 秒.小数（1分未満）  例: 30.20
    if (!/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1])) throw new Error(fmtErr);
    return Math.round(Number(parts[0] + '.' + parts[1]) * 100) / 100;
  }
  if (parts.length === 3) {
    // 分.秒.小数  例: 1.23.45
    if (!/^\d+$/.test(parts[0]) || !/^[0-5]?\d$/.test(parts[1]) || !/^\d{1,2}$/.test(parts[2])) {
      throw new Error(fmtErr);
    }
    const total = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) + parseFloat('0.' + parts[2]);
    return Math.round(total * 100) / 100;
  }
  throw new Error(fmtErr);
}

/**
 * 秒数を "M.SS.hh" 形式に整形する（1分以上なら分表記、未満なら秒のみ）。
 *   83.45 -> "1.23.45"
 *   30.2  -> "30.20"
 */
function formatSeconds_(sec) {
  const v = Number(sec) || 0;
  if (v >= 60) {
    const m = Math.floor(v / 60);
    const s = v - m * 60;
    let sStr = s.toFixed(2);
    if (sStr.length < 5) sStr = '0' + sStr; // "9.50" -> "09.50"
    return m + '.' + sStr;
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

    // ラップ（各50mの経過タイム文字列の配列）が来ていれば秒数化して検証する
    let laps = null;
    let seconds;
    if (t.laps && t.laps.length) {
      const lapSecs = t.laps.map(function (x) { return parseTimeToSeconds_(x); });
      for (let k = 1; k < lapSecs.length; k++) {
        if (lapSecs[k] < lapSecs[k - 1]) {
          throw new Error('経過タイムは前の区間より大きくなる必要があります');
        }
      }
      laps = lapSecs;
      seconds = lapSecs[lapSecs.length - 1];
    } else {
      seconds = parseTimeToSeconds_(t.time);
    }
    return {
      event: String(t.event || '').trim(),
      distance: Number(t.distance) || 0,
      seconds: seconds,
      pool: String(t.pool || '').trim(),
      format: format,
      laps: laps
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
      return [Utilities.getUuid(), logId, payload.date, t.event, t.distance, t.seconds, t.pool,
              t.format, t.laps ? JSON.stringify(t.laps) : ''];
    });
    timeSheet.getRange(timeSheet.getLastRow() + 1, 1, rows.length, 9).setValues(rows);
  }

  return { ok: true, id: logId };
}

// ===== 練習記録：履歴・カレンダー取得 =====

/** タイム記録の1行をフロント用オブジェクトに変換（ラップ・区間も展開） */
function buildTimeRecord_(row, tz) {
  const seconds = Number(row[5]);
  let cumLaps = [];
  if (row[8]) {
    try { cumLaps = JSON.parse(row[8]) || []; } catch (e) { cumLaps = []; }
  }
  const laps = [];
  let prev = 0;
  cumLaps.forEach(function (c, i) {
    const split = Math.round((c - prev) * 100) / 100;
    prev = c;
    laps.push({
      dist: (i + 1) * 50,
      cum: c,
      cumText: formatSeconds_(c),
      split: split,
      splitText: formatSeconds_(split)
    });
  });
  return {
    id: String(row[0]),
    logId: String(row[1]),
    date: fmtDate_(row[2], tz),
    event: String(row[3]),
    distance: Number(row[4]),
    seconds: seconds,
    timeText: formatSeconds_(seconds),
    pool: String(row[6] || ''),
    format: String(row[7] || DEFAULT_FORMAT),
    laps: laps
  };
}

/** logId -> タイム記録配列 のマップを作る */
function timesByLog_(tz) {
  const timeValues = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TIME).getDataRange().getValues();
  const map = {};
  for (let i = 1; i < timeValues.length; i++) {
    const row = timeValues[i];
    if (!row[0]) continue;
    const logId = String(row[1]);
    if (!map[logId]) map[logId] = [];
    map[logId].push(buildTimeRecord_(row, tz));
  }
  return map;
}

/**
 * カレンダー表示用に、指定年月の練習日サマリと今月の総距離を返す。
 *   { year, month, monthDistance, days: { 'yyyy-MM-dd': {distance, count} } }
 */
function getCalendarMonth(year, month) {
  setupSheets_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const values = ss.getSheetByName(SHEET_PRACTICE).getDataRange().getValues();
  const days = {};
  let monthDistance = 0;
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue;
    const d = new Date(row[1]);
    if (d.getFullYear() !== year || (d.getMonth() + 1) !== month) continue;
    const dateStr = fmtDate_(row[1], tz);
    if (!days[dateStr]) days[dateStr] = { distance: 0, count: 0 };
    const dist = Number(row[2]) || 0;
    days[dateStr].distance += dist;
    days[dateStr].count += 1;
    monthDistance += dist;
  }
  return { year: year, month: month, monthDistance: monthDistance, days: days };
}

/** 指定日の練習ログ一覧（各ログにタイム記録・ラップをぶら下げる）を返す */
function getDayLogs(dateStr) {
  setupSheets_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const byLog = timesByLog_(tz);

  const logValues = ss.getSheetByName(SHEET_PRACTICE).getDataRange().getValues();
  const logs = [];
  for (let i = 1; i < logValues.length; i++) {
    const row = logValues[i];
    if (!row[0]) continue;
    if (fmtDate_(row[1], tz) !== dateStr) continue;
    const logId = String(row[0]);
    logs.push({
      id: logId,
      date: fmtDate_(row[1], tz),
      distance: Number(row[2]) || 0,
      memo: String(row[3] || ''),
      times: byLog[logId] || []
    });
  }
  return logs;
}

/**
 * 練習ログを日付の新しい順で返す（各ログにタイム記録をぶら下げる）。
 * eventFilter を渡すと、その種目を含む練習日のみに絞り込む。（互換用に残置）
 */
function getHistory(eventFilter) {
  setupSheets_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const byLog = timesByLog_(tz);

  const logValues = ss.getSheetByName(SHEET_PRACTICE).getDataRange().getValues();
  const logs = [];
  for (let i = 1; i < logValues.length; i++) {
    const row = logValues[i];
    if (!row[0]) continue;
    const logId = String(row[0]);
    const times = byLog[logId] || [];
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

// ===== 大会カウントダウン =====
function getRaceCounters() {
  setupSheets_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const values = ss.getSheetByName(SHEET_RACE).getDataRange().getValues();
  const races = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue;
    races.push({
      id: String(row[0]),
      name: String(row[1] || ''),
      date: fmtDate_(row[2], tz)
    });
  }
  races.sort((a, b) => a.date.localeCompare(b.date));
  return races;
}

function addRaceCounter(name, date) {
  setupSheets_();
  if (!String(name || '').trim()) throw new Error('大会名を入力してください');
  if (!date) throw new Error('日付を入力してください');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_RACE);
  sheet.appendRow([Utilities.getUuid(), String(name).trim(), date]);
  return getRaceCounters();
}

function deleteRaceCounter(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_RACE);
  const rowIndex = findRowById_(sheet, id);
  if (rowIndex > 0) sheet.deleteRow(rowIndex);
  return getRaceCounters();
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
 * ある種目で記録のある距離の一覧（昇順・重複なし）を返す。
 * 練習(TT) と 試合記録 の両方を対象にする。
 */
function getEventDistances(eventName) {
  setupSheets_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const set = {};

  const t = ss.getSheetByName(SHEET_TIME).getDataRange().getValues();
  for (let i = 1; i < t.length; i++) {
    const row = t[i];
    if (!row[0]) continue;
    if (String(row[3]) !== eventName) continue;
    if (String(row[7] || DEFAULT_FORMAT) !== 'TT') continue;
    const d = Number(row[4]);
    if (d > 0) set[d] = true;
  }
  const m = ss.getSheetByName(SHEET_MEET).getDataRange().getValues();
  for (let i = 1; i < m.length; i++) {
    const row = m[i];
    if (!row[0]) continue;
    if (String(row[4]) !== eventName) continue;
    const d = Number(row[5]);
    if (d > 0) set[d] = true;
  }
  return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
}

/**
 * 種目・距離・水路タイプ・期間で絞り込んだタイムを日付昇順で返す。
 * 練習（TT）と試合記録の両方を返す。
 *   { practice: [...], meet: [...] }
 * distance : 対象距離(m)。0/falsy の場合は距離で絞り込まない。
 * laneType : '長水路' | '短水路' | '両方'
 * period   : 'week'(7日) | 'month'(30日) | '3month'(90日) | 'all'
 */
function getAnalysisData(eventName, distance, laneType, period) {
  setupSheets_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const laneMap = poolLaneMap_();
  const minDate = periodMinDate_(period, tz);
  const dist = Number(distance) || 0;

  // ---- 練習タイム（TTのみ） ----
  const timeValues = ss.getSheetByName(SHEET_TIME).getDataRange().getValues();
  const practice = [];
  for (let i = 1; i < timeValues.length; i++) {
    const row = timeValues[i];
    if (!row[0]) continue;
    if (String(row[3]) !== eventName) continue;
    if (dist && Number(row[4]) !== dist) continue;

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
    if (dist && Number(row[5]) !== dist) continue;

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
      lane: lane,
      kind: String(row[7] || DEFAULT_MEET_KIND)
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
      timeText: formatSeconds_(Number(row[6]) || 0),
      kind: String(row[7] || DEFAULT_MEET_KIND)
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
  let kind = String(payload.kind || DEFAULT_MEET_KIND);
  if (MEET_KINDS.indexOf(kind) < 0) kind = DEFAULT_MEET_KIND;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MEET);
  const id = payload.id || Utilities.getUuid();
  const row = [
    id,
    String(payload.meetName).trim(),
    payload.date,
    payload.lane,
    String(payload.event).trim(),
    Number(payload.distance) || 0,
    seconds,
    kind
  ];
  if (payload.id) {
    const rowIndex = findRowById_(sheet, payload.id);
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, 8).setValues([row]);
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

/**
 * 試合記録から自己ベストを集計して返す。
 * 種別(正式/引継ぎ) × 種目 × 距離 ごとに最速タイムを1件だけ抽出する。
 * laneType : '長水路' | '短水路' | '両方'（水路タイプで絞り込み）
 * 戻り値: { "種別|種目|距離": { seconds, timeText, date, meetName, lane }, ... }
 */
function getBestTimes(laneType) {
  setupSheets_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const values = ss.getSheetByName(SHEET_MEET).getDataRange().getValues();
  const best = {};
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue;
    const lane = String(row[3] || '');
    if (laneType && laneType !== '両方' && lane !== laneType) continue;

    const seconds = Number(row[6]);
    if (!(seconds > 0)) continue;
    const event = String(row[4] || '');
    const distance = Number(row[5]) || 0;
    const kind = String(row[7] || DEFAULT_MEET_KIND);
    const key = kind + '|' + event + '|' + distance;

    const cur = best[key];
    if (!cur || seconds < cur.seconds) {
      best[key] = {
        seconds: seconds,
        timeText: formatSeconds_(seconds),
        date: fmtDate_(row[2], tz),
        meetName: String(row[1] || ''),
        lane: lane
      };
    }
  }
  return best;
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

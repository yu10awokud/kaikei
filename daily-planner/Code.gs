/**
 * 予定・タスク・日次活動ログ 一括管理ツール(GAS Webアプリ)
 * --------------------------------------------------
 * - 月表示カレンダー(日ごとの活動マーク + Googleカレンダーの予定表示)
 * - 日次入力パネル(大学1〜5限 / 部活 / 筋トレ / メモ / タスク進捗)
 * - タスク管理(短期・中長期、期限・優先度・ステータス・進捗率)
 * - 記録カテゴリの追加(大学・部活・筋トレ以外も自由に増やせる)
 * - 時間割マスタ(曜日ごとの科目を登録すると日次入力に自動反映)
 *
 * データはこのスクリプトに紐づいたスプレッドシートに保存します。
 * シートが無ければ初回アクセス時に自動生成します。
 * (スタンドアロンスクリプトの場合は専用スプレッドシートを自動作成します)
 */

// ===== シート名 =====
const SHEET_DAILY      = '日次記録';
const SHEET_TASKS      = 'タスク';
const SHEET_CATEGORIES = 'カテゴリ';
const SHEET_TIMETABLE  = '時間割';

// ===== 見出し行 =====
const DAILY_HEADERS = [
  '日付', '大学', '部活', '部活メモ', '筋トレ', '筋トレ詳細',
  'メモ', '短期タスク進捗', '中長期タスク進捗', 'カスタム',
];
const TASK_HEADERS      = ['タスクID', 'タスク名', '種別', '期限', '優先度', 'ステータス', '進捗率'];
const CATEGORY_HEADERS  = ['カテゴリID', '名前', '色', '固定'];
const TIMETABLE_HEADERS = ['曜日', '1限', '2限', '3限', '4限', '5限'];

// デフォルトの記録カテゴリ(固定 = 削除不可。色は変更可能)
const DEFAULT_CATEGORIES = [
  { id: 'univ',     name: '大学',   color: '#4285f4', fixed: true },
  { id: 'club',     name: '部活',   color: '#34a853', fixed: true },
  { id: 'training', name: '筋トレ', color: '#fb8c00', fixed: true },
];

const TIMETABLE_DAYS = ['月', '火', '水', '木', '金', '土', '日'];
const JS_DAY_TO_JP   = ['日', '月', '火', '水', '木', '金', '土']; // Date#getDay() の並び
const PERIOD_COUNT   = 5;

// ==================================================
// エントリポイント
// ==================================================

/** Webアプリのエントリポイント */
function doGet() {
  setupSheets();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('予定・タスク管理')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** HTMLテンプレートから別ファイルを読み込む */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * 初回セットアップ(手動実行用)。
 * エディタからこの関数を一度実行して権限を承認しておくと、
 * Webアプリのデプロイがスムーズです。
 */
function setup() {
  setupSheets();
  Logger.log('セットアップ完了: ' + getSpreadsheet_().getUrl());
}

// ==================================================
// スプレッドシート準備
// ==================================================

/**
 * 保存先スプレッドシートを取得する。
 * コンテナバインド(シートの拡張機能から作成)ならそのシートを、
 * スタンドアロンなら専用シートを自動作成してIDを保存する。
 */
function getSpreadsheet_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty('SPREADSHEET_ID');
  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (e) {
      // 削除済みなどで開けない場合は作り直す
    }
  }
  const ss = SpreadsheetApp.create('予定・タスク管理データ');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

/** 必要なシートと見出し行が無ければ作成する */
function setupSheets() {
  const ss = getSpreadsheet_();

  const daily = getOrCreateSheet_(ss, SHEET_DAILY, DAILY_HEADERS);
  // 日付列は文字列として保持する(勝手に日付型へ変換されるのを防ぐ)
  daily.getRange(1, 1, daily.getMaxRows(), 1).setNumberFormat('@');

  const tasks = getOrCreateSheet_(ss, SHEET_TASKS, TASK_HEADERS);
  tasks.getRange(1, 4, tasks.getMaxRows(), 1).setNumberFormat('@'); // 期限列

  const cats = getOrCreateSheet_(ss, SHEET_CATEGORIES, CATEGORY_HEADERS);
  if (cats.getLastRow() <= 1) {
    const rows = DEFAULT_CATEGORIES.map(c => [c.id, c.name, c.color, true]);
    cats.getRange(2, 1, rows.length, CATEGORY_HEADERS.length).setValues(rows);
  }

  const tt = getOrCreateSheet_(ss, SHEET_TIMETABLE, TIMETABLE_HEADERS);
  if (tt.getLastRow() <= 1) {
    const rows = TIMETABLE_DAYS.map(d => [d, '', '', '', '', '']);
    tt.getRange(2, 1, rows.length, TIMETABLE_HEADERS.length).setValues(rows);
  }
}

/** 指定名のシートを取得。無ければ作成して見出し行を書き込む */
function getOrCreateSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#e8eaf6');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ==================================================
// 共通ユーティリティ
// ==================================================

/** Date -> 'yyyy-MM-dd' */
function formatDate_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** 'yyyy-MM-dd' -> Date(その日の0時) */
function parseDate_(str) {
  const parts = String(str).split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error('日付の形式が不正です: ' + str);
  }
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

/** セル値(Date/文字列)を 'yyyy-MM-dd' に正規化 */
function toDateString_(value) {
  if (value instanceof Date) return formatDate_(value);
  return String(value || '').trim();
}

/** JSON文字列を安全にパースする(失敗時はフォールバック値) */
function parseJson_(s, fallback) {
  if (!s) return fallback;
  try {
    const v = JSON.parse(s);
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

/** スクリプトロックを取ってfnを実行する(保存系の競合防止) */
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10 * 1000)) {
    throw new Error('他の保存処理が実行中です。少し待ってからやり直してください。');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// ==================================================
// 日次記録
// ==================================================

/** 空の日次データ(時間割から科目をプリセット) */
function emptyDayData_(dateStr) {
  const jpDay = JS_DAY_TO_JP[parseDate_(dateStr).getDay()];
  const timetable = getTimetable();
  const subjects = timetable[jpDay] || ['', '', '', '', ''];
  const university = [];
  for (let i = 0; i < PERIOD_COUNT; i++) {
    university.push({ period: i + 1, subject: subjects[i] || '', attended: false, memo: '' });
  }
  return {
    date: dateStr,
    university: university,
    club: { done: false, memo: '' },
    training: { done: false, detail: '' },
    memo: '',
    shortTask: '',
    longTask: '',
    custom: {},
    isNew: true,
  };
}

/** シート1行 -> 日次データオブジェクト */
function rowToRecord_(row) {
  const dateStr = toDateString_(row[0]);
  const university = parseJson_(row[1], []);
  // 5限分の形に整える(古いデータや欠損があっても崩れないように)
  const periods = [];
  for (let i = 0; i < PERIOD_COUNT; i++) {
    const p = university[i] || {};
    periods.push({
      period: i + 1,
      subject: String(p.subject || ''),
      attended: !!p.attended,
      memo: String(p.memo || ''),
    });
  }
  return {
    date: dateStr,
    university: periods,
    club: { done: row[2] === true || row[2] === 'TRUE', memo: String(row[3] || '') },
    training: { done: row[4] === true || row[4] === 'TRUE', detail: String(row[5] || '') },
    memo: String(row[6] || ''),
    shortTask: String(row[7] || ''),
    longTask: String(row[8] || ''),
    custom: parseJson_(row[9], {}),
    isNew: false,
  };
}

/** 日次データオブジェクト -> シート1行 */
function recordToRow_(dateStr, data) {
  const university = (data.university || []).map((p, i) => ({
    period: i + 1,
    subject: String(p.subject || ''),
    attended: !!p.attended,
    memo: String(p.memo || ''),
  }));
  const club = data.club || {};
  const training = data.training || {};
  const custom = data.custom && typeof data.custom === 'object' ? data.custom : {};
  return [
    dateStr,
    JSON.stringify(university),
    !!club.done,
    String(club.memo || ''),
    !!training.done,
    String(training.detail || ''),
    String(data.memo || ''),
    String(data.shortTask || ''),
    String(data.longTask || ''),
    JSON.stringify(custom),
  ];
}

/** 記録からカレンダーに表示するマーク(該当カテゴリID一覧)を求める */
function recordToMarks_(record, categoryIds) {
  const marks = [];
  if ((record.university || []).some(p => p.attended)) marks.push('univ');
  if (record.club && record.club.done) marks.push('club');
  if (record.training && record.training.done) marks.push('training');
  Object.keys(record.custom || {}).forEach(id => {
    if (record.custom[id] && record.custom[id].done && categoryIds.indexOf(id) >= 0) {
      marks.push(id);
    }
  });
  return marks;
}

/**
 * 指定月の全日次記録とGoogleカレンダーの予定を取得する
 * @return {Object} { days, events, categories, calendarOk }
 */
function getMonthData(year, month) {
  setupSheets();
  year = Number(year);
  month = Number(month);
  if (!year || !month || month < 1 || month > 12) {
    throw new Error('年月の指定が不正です');
  }

  const categoriesList = getCategories();
  const categoryIds = categoriesList.map(c => c.id);
  const prefix = year + '-' + ('0' + month).slice(-2) + '-';

  // --- 日次記録 ---
  const days = {};
  const sheet = getSpreadsheet_().getSheetByName(SHEET_DAILY);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const dateStr = toDateString_(values[i][0]);
    if (dateStr.indexOf(prefix) !== 0) continue;
    const record = rowToRecord_(values[i]);
    days[dateStr] = { marks: recordToMarks_(record, categoryIds), hasData: true };
  }

  // --- Googleカレンダーの予定 ---
  const events = {};
  let calendarOk = true;
  try {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const tz = Session.getScriptTimeZone();
    CalendarApp.getDefaultCalendar().getEvents(start, end).forEach(ev => {
      const dateStr = formatDate_(ev.getStartTime());
      if (!events[dateStr]) events[dateStr] = [];
      events[dateStr].push({
        title: ev.getTitle() || '(無題)',
        time: ev.isAllDayEvent() ? '' : Utilities.formatDate(ev.getStartTime(), tz, 'HH:mm'),
        allDay: ev.isAllDayEvent(),
      });
    });
  } catch (e) {
    calendarOk = false;
    console.warn('カレンダー取得に失敗: ' + e.message);
  }

  return { year: year, month: month, days: days, events: events, categories: categoriesList, calendarOk: calendarOk };
}

/**
 * 指定日の詳細データを取得する(記録が無ければ初期値を返す)
 * @param {string} dateStr 'yyyy-MM-dd'
 */
function getDayData(dateStr) {
  setupSheets();
  parseDate_(dateStr); // 形式チェック

  const sheet = getSpreadsheet_().getSheetByName(SHEET_DAILY);
  const values = sheet.getDataRange().getValues();
  let data = null;
  for (let i = 1; i < values.length; i++) {
    if (toDateString_(values[i][0]) === dateStr) {
      data = rowToRecord_(values[i]);
      break;
    }
  }
  if (!data) data = emptyDayData_(dateStr);

  // その日のGoogleカレンダー予定も添えて返す
  data.events = [];
  try {
    const day = parseDate_(dateStr);
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    const tz = Session.getScriptTimeZone();
    data.events = CalendarApp.getDefaultCalendar().getEvents(day, next).map(ev => ({
      title: ev.getTitle() || '(無題)',
      time: ev.isAllDayEvent() ? '' : Utilities.formatDate(ev.getStartTime(), tz, 'HH:mm'),
      allDay: ev.isAllDayEvent(),
    }));
  } catch (e) {
    console.warn('カレンダー取得に失敗: ' + e.message);
  }

  data.categories = getCategories();
  return data;
}

/**
 * 指定日のデータを保存・更新する(該当行が無ければ新規作成)
 * @param {string} dateStr 'yyyy-MM-dd'
 * @param {Object} data 日次データ
 */
function saveDayData(dateStr, data) {
  setupSheets();
  parseDate_(dateStr); // 形式チェック
  if (!data || typeof data !== 'object') throw new Error('保存データが不正です');

  return withLock_(() => {
    const sheet = getSpreadsheet_().getSheetByName(SHEET_DAILY);
    const row = recordToRow_(dateStr, data);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (toDateString_(values[i][0]) === dateStr) {
        sheet.getRange(i + 1, 1, 1, DAILY_HEADERS.length).setValues([row]);
        return { ok: true, updated: true };
      }
    }
    sheet.appendRow(row);
    return { ok: true, updated: false };
  });
}

// ==================================================
// タスク管理
// ==================================================

/** シート1行 -> タスクオブジェクト */
function rowToTask_(row) {
  return {
    id: String(row[0] || ''),
    name: String(row[1] || ''),
    type: row[2] === '中長期' ? '中長期' : '短期',
    due: toDateString_(row[3]),
    priority: ['高', '中', '低'].indexOf(String(row[4])) >= 0 ? String(row[4]) : '中',
    status: ['未着手', '進行中', '完了'].indexOf(String(row[5])) >= 0 ? String(row[5]) : '未着手',
    progress: Math.max(0, Math.min(100, Number(row[6]) || 0)),
  };
}

/** タスク一覧を取得する */
function getTasks() {
  setupSheets();
  const sheet = getSpreadsheet_().getSheetByName(SHEET_TASKS);
  const values = sheet.getDataRange().getValues();
  const tasks = [];
  for (let i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    tasks.push(rowToTask_(values[i]));
  }
  return tasks;
}

/**
 * タスクを追加・更新する(idが無い/見つからない場合は新規追加)
 * @param {Object} task {id, name, type, due, priority, status, progress}
 * @return {Object[]} 最新のタスク一覧
 */
function saveTask(task) {
  setupSheets();
  if (!task || !String(task.name || '').trim()) {
    throw new Error('タスク名を入力してください');
  }
  const normalized = rowToTask_([
    task.id || Utilities.getUuid(),
    String(task.name).trim(),
    task.type,
    task.due || '',
    task.priority,
    task.status,
    task.progress,
  ]);
  const row = [
    normalized.id, normalized.name, normalized.type, normalized.due,
    normalized.priority, normalized.status, normalized.progress,
  ];

  return withLock_(() => {
    const sheet = getSpreadsheet_().getSheetByName(SHEET_TASKS);
    const values = sheet.getDataRange().getValues();
    let found = false;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === normalized.id) {
        sheet.getRange(i + 1, 1, 1, TASK_HEADERS.length).setValues([row]);
        found = true;
        break;
      }
    }
    if (!found) sheet.appendRow(row);
    return getTasks();
  });
}

/**
 * タスクを削除する
 * @return {Object[]} 最新のタスク一覧
 */
function deleteTask(taskId) {
  setupSheets();
  if (!taskId) throw new Error('タスクIDが指定されていません');

  return withLock_(() => {
    const sheet = getSpreadsheet_().getSheetByName(SHEET_TASKS);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(taskId)) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    return getTasks();
  });
}

// ==================================================
// 記録カテゴリ
// ==================================================

/** カテゴリ一覧を取得する */
function getCategories() {
  setupSheets();
  const sheet = getSpreadsheet_().getSheetByName(SHEET_CATEGORIES);
  const values = sheet.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    list.push({
      id: String(values[i][0]),
      name: String(values[i][1] || ''),
      color: String(values[i][2] || '#9e9e9e'),
      fixed: values[i][3] === true || values[i][3] === 'TRUE',
    });
  }
  return list;
}

/**
 * カテゴリを追加・更新する(固定カテゴリは色のみ変更可能)
 * @return {Object[]} 最新のカテゴリ一覧
 */
function saveCategory(category) {
  setupSheets();
  if (!category) throw new Error('カテゴリが指定されていません');
  const name = String(category.name || '').trim();
  const color = /^#[0-9a-fA-F]{6}$/.test(String(category.color)) ? category.color : '#9e9e9e';

  return withLock_(() => {
    const sheet = getSpreadsheet_().getSheetByName(SHEET_CATEGORIES);
    const values = sheet.getDataRange().getValues();
    if (category.id) {
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(category.id)) {
          const fixed = values[i][3] === true || values[i][3] === 'TRUE';
          if (!fixed && name) sheet.getRange(i + 1, 2).setValue(name);
          sheet.getRange(i + 1, 3).setValue(color);
          return getCategories();
        }
      }
    }
    // 新規追加
    if (!name) throw new Error('カテゴリ名を入力してください');
    sheet.appendRow([Utilities.getUuid(), name, color, false]);
    return getCategories();
  });
}

/**
 * カテゴリを削除する(固定カテゴリは削除不可)
 * @return {Object[]} 最新のカテゴリ一覧
 */
function deleteCategory(categoryId) {
  setupSheets();
  if (!categoryId) throw new Error('カテゴリIDが指定されていません');

  return withLock_(() => {
    const sheet = getSpreadsheet_().getSheetByName(SHEET_CATEGORIES);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(categoryId)) {
        const fixed = values[i][3] === true || values[i][3] === 'TRUE';
        if (fixed) throw new Error('デフォルトのカテゴリは削除できません');
        sheet.deleteRow(i + 1);
        break;
      }
    }
    return getCategories();
  });
}

// ==================================================
// 時間割(科目マスタ)
// ==================================================

/** 時間割を取得する @return {Object} { '月': [科目x5], ... } */
function getTimetable() {
  setupSheets();
  const sheet = getSpreadsheet_().getSheetByName(SHEET_TIMETABLE);
  const values = sheet.getDataRange().getValues();
  const result = {};
  TIMETABLE_DAYS.forEach(d => { result[d] = ['', '', '', '', '']; });
  for (let i = 1; i < values.length; i++) {
    const day = String(values[i][0]);
    if (TIMETABLE_DAYS.indexOf(day) < 0) continue;
    result[day] = [];
    for (let p = 1; p <= PERIOD_COUNT; p++) {
      result[day].push(String(values[i][p] || ''));
    }
  }
  return result;
}

/**
 * 時間割を保存する
 * @param {Object} timetable { '月': [科目x5], ... }
 */
function saveTimetable(timetable) {
  setupSheets();
  if (!timetable || typeof timetable !== 'object') throw new Error('時間割データが不正です');

  return withLock_(() => {
    const sheet = getSpreadsheet_().getSheetByName(SHEET_TIMETABLE);
    const rows = TIMETABLE_DAYS.map(d => {
      const subjects = Array.isArray(timetable[d]) ? timetable[d] : [];
      const row = [d];
      for (let p = 0; p < PERIOD_COUNT; p++) row.push(String(subjects[p] || ''));
      return row;
    });
    sheet.getRange(2, 1, rows.length, TIMETABLE_HEADERS.length).setValues(rows);
    return { ok: true };
  });
}

// ==================================================
// Googleカレンダーへの予定登録
// ==================================================

/**
 * Googleカレンダーに予定を追加する
 * @param {string} dateStr 'yyyy-MM-dd'
 * @param {string} title 予定タイトル
 * @param {string} startTime 'HH:mm'(空なら終日予定)
 * @param {string} endTime 'HH:mm'(空なら開始+1時間)
 */
function addCalendarEvent(dateStr, title, startTime, endTime) {
  const day = parseDate_(dateStr);
  title = String(title || '').trim();
  if (!title) throw new Error('予定のタイトルを入力してください');

  const cal = CalendarApp.getDefaultCalendar();
  if (!startTime) {
    cal.createAllDayEvent(title, day);
    return { ok: true, allDay: true };
  }
  const start = combineDateTime_(day, startTime);
  let end = endTime ? combineDateTime_(day, endTime) : null;
  if (!end || end <= start) {
    end = new Date(start.getTime() + 60 * 60 * 1000); // 既定は1時間
  }
  cal.createEvent(title, start, end);
  return { ok: true, allDay: false };
}

/** Date + 'HH:mm' -> Date */
function combineDateTime_(day, hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!m) throw new Error('時刻の形式が不正です: ' + hhmm);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(m[1]), Number(m[2]));
}

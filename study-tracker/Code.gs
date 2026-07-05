/**
 * テスト勉強進捗管理ツール（GAS Webアプリ）
 * --------------------------------------------------
 * - 科目ごとの試験日カウントダウン
 * - タスク単位の進捗率管理（スライダーで更新）
 * - 期限アラート / 全体進捗ゲージ
 *
 * データ保存先:
 *   - コンテナバインド型（スプレッドシートの拡張機能から作成）なら、そのスプレッドシート
 *   - スタンドアロン型なら、初回アクセス時に専用スプレッドシートを自動作成し、
 *     スクリプトプロパティ SPREADSHEET_ID に保存して以後使い回す
 *
 * 拡張しやすいように、シート定義は SHEET_DEFS にまとめてある。
 * 新しいデータ種別（勉強時間ログなど）を足す場合は SHEET_DEFS に定義を追加し、
 * 対応する read/write 関数を増やせばよい。
 */

// ===== シート定義 =====
var SHEET_DEFS = {
  subjects: {
    name: 'Subjects',
    headers: ['SubjectID', '科目名', '表示順', '試験日']
  },
  tasks: {
    name: 'Tasks',
    headers: ['TaskID', 'SubjectID', 'タスク名', '進捗率', '期限日', 'メモ', '作成日時', '更新日時']
  }
};

var PROP_SPREADSHEET_ID = 'SPREADSHEET_ID';
var TZ = Session.getScriptTimeZone() || 'Asia/Tokyo';

// ===== Webアプリのエントリーポイント =====
function doGet() {
  setupSheets_();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('テスト勉強 進捗ダッシュボード')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// CSS / JS を別ファイルに分割して読み込むヘルパー
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ===== スプレッドシートの取得・初期化 =====

function getSpreadsheet_() {
  // コンテナバインドならそれを使う
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;

  // スタンドアロン: 保存済みIDがあれば開く。無ければ新規作成
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_SPREADSHEET_ID);
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      // 削除されていた場合は作り直す
    }
  }
  ss = SpreadsheetApp.create('テスト勉強進捗管理データ');
  props.setProperty(PROP_SPREADSHEET_ID, ss.getId());
  return ss;
}

function setupSheets_() {
  var ss = getSpreadsheet_();
  Object.keys(SHEET_DEFS).forEach(function (key) {
    var def = SHEET_DEFS[key];
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    }
    // ヘッダー行が空なら書き込む（既存データは触らない）
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers])
        .setFontWeight('bold');
      sheet.setFrozenRows(1);
      // 日付・IDセルの意図しない自動変換を避けるため書式をプレーンテキストに
      sheet.getRange(2, 1, sheet.getMaxRows() - 1, def.headers.length).setNumberFormat('@');
    }
  });
}

function getSheet_(key) {
  setupSheets_();
  return getSpreadsheet_().getSheetByName(SHEET_DEFS[key].name);
}

// ===== 共通ヘルパー =====

function newId_(prefix) {
  return prefix + '_' + Utilities.getUuid().slice(0, 8);
}

function nowString_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
}

// セル値を 'yyyy-MM-dd' 文字列に正規化（Date型・文字列どちらでも受ける）
function normalizeDate_(value) {
  if (value === null || value === undefined || value === '') return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, TZ, 'yyyy-MM-dd');
  }
  var s = String(value).trim();
  var m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) {
    return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  }
  return '';
}

function clampProgress_(value) {
  var n = Number(value);
  if (isNaN(n)) n = 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ID列（1列目）でデータ行を探す。見つからなければ -1
function findRowById_(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

// 書き込み系を排他制御付きで実行
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// ===== 取得 API =====

/**
 * ダッシュボード表示に必要なデータをまとめて返す。
 * 日付はすべて 'yyyy-MM-dd' 文字列に正規化して返す（google.script.run はDate非対応のため）。
 */
function getDashboardData() {
  var subjectSheet = getSheet_('subjects');
  var taskSheet = getSheet_('tasks');

  var subjects = [];
  var lastS = subjectSheet.getLastRow();
  if (lastS >= 2) {
    subjectSheet.getRange(2, 1, lastS - 1, SHEET_DEFS.subjects.headers.length)
      .getValues()
      .forEach(function (row) {
        if (!row[0]) return; // 空行はスキップ
        subjects.push({
          subjectId: String(row[0]),
          name: String(row[1]),
          order: Number(row[2]) || 0,
          examDate: normalizeDate_(row[3])
        });
      });
  }
  subjects.sort(function (a, b) { return a.order - b.order; });

  var tasks = [];
  var lastT = taskSheet.getLastRow();
  if (lastT >= 2) {
    taskSheet.getRange(2, 1, lastT - 1, SHEET_DEFS.tasks.headers.length)
      .getValues()
      .forEach(function (row) {
        if (!row[0]) return;
        tasks.push({
          taskId: String(row[0]),
          subjectId: String(row[1]),
          name: String(row[2]),
          progress: clampProgress_(row[3]),
          dueDate: normalizeDate_(row[4]),
          memo: String(row[5] || ''),
          createdAt: String(row[6] || ''),
          updatedAt: String(row[7] || '')
        });
      });
  }

  return {
    subjects: subjects,
    tasks: tasks,
    today: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd')
  };
}

// ===== 科目 API =====

function addSubject(name, examDate) {
  name = String(name || '').trim();
  if (!name) throw new Error('科目名を入力してください');
  return withLock_(function () {
    var sheet = getSheet_('subjects');
    // 表示順は末尾に追加
    var maxOrder = 0;
    var last = sheet.getLastRow();
    if (last >= 2) {
      sheet.getRange(2, 3, last - 1, 1).getValues().forEach(function (r) {
        var n = Number(r[0]);
        if (!isNaN(n) && n > maxOrder) maxOrder = n;
      });
    }
    var id = newId_('S');
    sheet.appendRow([id, name, maxOrder + 1, normalizeDate_(examDate)]);
    return getDashboardData();
  });
}

function updateSubjectExamDate(subjectId, examDate) {
  return withLock_(function () {
    var sheet = getSheet_('subjects');
    var row = findRowById_(sheet, subjectId);
    if (row < 0) throw new Error('科目が見つかりません');
    sheet.getRange(row, 4).setValue(normalizeDate_(examDate));
    return getDashboardData();
  });
}

function updateSubjectName(subjectId, name) {
  name = String(name || '').trim();
  if (!name) throw new Error('科目名を入力してください');
  return withLock_(function () {
    var sheet = getSheet_('subjects');
    var row = findRowById_(sheet, subjectId);
    if (row < 0) throw new Error('科目が見つかりません');
    sheet.getRange(row, 2).setValue(name);
    return getDashboardData();
  });
}

/** 科目を削除する。属するタスクも一緒に削除する */
function deleteSubject(subjectId) {
  return withLock_(function () {
    var sheet = getSheet_('subjects');
    var row = findRowById_(sheet, subjectId);
    if (row < 0) throw new Error('科目が見つかりません');
    sheet.deleteRow(row);

    // 属するタスクを下から順に削除（行番号がずれないように）
    var taskSheet = getSheet_('tasks');
    var last = taskSheet.getLastRow();
    if (last >= 2) {
      var values = taskSheet.getRange(2, 2, last - 1, 1).getValues();
      for (var i = values.length - 1; i >= 0; i--) {
        if (String(values[i][0]) === String(subjectId)) {
          taskSheet.deleteRow(i + 2);
        }
      }
    }
    return getDashboardData();
  });
}

// ===== タスク API =====

function addTask(subjectId, name, dueDate) {
  name = String(name || '').trim();
  if (!name) throw new Error('タスク名を入力してください');
  return withLock_(function () {
    var subjectSheet = getSheet_('subjects');
    if (findRowById_(subjectSheet, subjectId) < 0) {
      throw new Error('科目が見つかりません');
    }
    var sheet = getSheet_('tasks');
    var now = nowString_();
    sheet.appendRow([newId_('T'), String(subjectId), name, 0, normalizeDate_(dueDate), '', now, now]);
    return getDashboardData();
  });
}

function updateTaskProgress(taskId, progress) {
  return withLock_(function () {
    var sheet = getSheet_('tasks');
    var row = findRowById_(sheet, taskId);
    if (row < 0) throw new Error('タスクが見つかりません');
    sheet.getRange(row, 4).setValue(clampProgress_(progress));
    sheet.getRange(row, 8).setValue(nowString_());
    return { taskId: String(taskId), progress: clampProgress_(progress) };
  });
}

function updateTaskMemo(taskId, memo) {
  return withLock_(function () {
    var sheet = getSheet_('tasks');
    var row = findRowById_(sheet, taskId);
    if (row < 0) throw new Error('タスクが見つかりません');
    sheet.getRange(row, 6).setValue(String(memo || ''));
    sheet.getRange(row, 8).setValue(nowString_());
    return { taskId: String(taskId) };
  });
}

function updateTaskDueDate(taskId, dueDate) {
  return withLock_(function () {
    var sheet = getSheet_('tasks');
    var row = findRowById_(sheet, taskId);
    if (row < 0) throw new Error('タスクが見つかりません');
    sheet.getRange(row, 5).setValue(normalizeDate_(dueDate));
    sheet.getRange(row, 8).setValue(nowString_());
    return getDashboardData();
  });
}

function deleteTask(taskId) {
  return withLock_(function () {
    var sheet = getSheet_('tasks');
    var row = findRowById_(sheet, taskId);
    if (row < 0) throw new Error('タスクが見つかりません');
    sheet.deleteRow(row);
    return getDashboardData();
  });
}

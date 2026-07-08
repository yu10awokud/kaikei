/**
 * 部活スケジュール共有カレンダー（GAS Webアプリ）
 * ==================================================
 * - 月間カレンダー（日曜始まり）で部活の予定を共有
 * - 予定の追加 / 編集 / 削除（色指定・単発 / 毎週繰り返し）
 * - 合宿・大会などの複数日イベントは帯（バー）表示
 * - 練習予定は「場所 / ブログ担当 / 時間」の3項目レイアウト
 *
 * データは下の SPREADSHEET_ID で指定したスプレッドシートに保存します。
 * ------------------------------------------------------------------
 * ★ここを直せば保存先が変わる★
 *   - 別ファイルで運用したい場合は SPREADSHEET_ID を差し替えてください。
 *   - 空文字 '' のままなら「このスクリプトに紐づくスプレッドシート」を使います
 *     （スタンドアロンではなく、スプレッドシートに紐づけて作った場合はこれでOK）。
 */

// ===== 設定（後から差し替え可能な定数） =====
const SPREADSHEET_ID = '';          // 例: '1AbCdEf...'（空ならアクティブなシートを使用）
const SHEET_NAME     = '予定';       // 予定を保存するシート名

// 予定の見出し行（列の並び順もこの通り）
const HEADERS = [
  'id', 'title', 'startDate', 'endDate',
  'color', 'type', 'place', 'blogUser',
  'time', 'recurrence', 'weekday'
];

// 予定に使う色のプリセット（フロントのボタンと合わせています）
const PRESET_COLORS = ['#4f86ff', '#ff6b6b', '#f6a609', '#38b48b', '#9b6dff', '#8a8a8a'];

// ===== Webアプリのエントリーポイント =====
function doGet() {
  setupSheet_(); // 念のため毎回シートの存在を保証
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('部活カレンダー')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

// HTMLファイルを読み込むためのヘルパー（CSS/JSを分割して include するため）
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ===== スプレッドシート取得・初期化 =====

/** 保存先スプレッドシートを取得（IDが空ならアクティブなものを使う） */
function getSpreadsheet_() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

/** 予定シートが無ければ作成し、見出し行を用意する */
function setupSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);

    // 使われていないデフォルトシートがあれば片付ける
    const blank = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
    if (blank && ss.getSheets().length > 1) {
      try { ss.deleteSheet(blank); } catch (e) {}
    }
  }
  return sheet;
}

// ===== 予定データの CRUD =====

/**
 * すべての予定を返す。
 * 複数日イベントや毎週繰り返しは表示側（フロント）で展開するため、
 * ここでは加工せず生データをそのまま渡します。
 * （データ件数が多くなってきたら年月で絞る改修をここに入れると軽くなります）
 */
function getSchedules() {
  const sheet = setupSheet_();
  const values = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  const list = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue; // id が無い行はスキップ
    list.push({
      id:         String(row[0]),
      title:      String(row[1] || ''),
      startDate:  toDateStr_(row[2], tz),
      endDate:    toDateStr_(row[3], tz),
      color:      String(row[4] || PRESET_COLORS[0]),
      type:       String(row[5] || 'event'),
      place:      String(row[6] || ''),
      blogUser:   String(row[7] || ''),
      time:       String(row[8] || ''),
      recurrence: String(row[9] || 'none'),
      weekday:    row[10] === '' || row[10] === null ? '' : Number(row[10])
    });
  }
  return list;
}

/**
 * 予定を1件保存する（id が無ければ新規、有れば更新）。
 * @param {Object} rec フロントから渡ってくる予定オブジェクト
 */
function saveSchedule(rec) {
  const sheet = setupSheet_();

  // endDate 未指定なら startDate と同じ（＝単日）にそろえる
  const start = rec.startDate;
  const end = rec.endDate || rec.startDate;

  // 毎週繰り返しの場合は startDate の曜日を保存（0=日 … 6=土）
  let weekday = '';
  if (rec.recurrence === 'weekly') {
    weekday = new Date(start + 'T00:00:00').getDay();
  }

  const newRow = [
    rec.id || Utilities.getUuid(),
    rec.title || '',
    start,
    end,
    rec.color || PRESET_COLORS[0],
    rec.type || 'event',
    rec.place || '',
    rec.blogUser || '',
    rec.time || '',
    rec.recurrence || 'none',
    weekday
  ];

  if (rec.id) {
    const rowIndex = findRowById_(sheet, rec.id);
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
      return { ok: true, id: rec.id };
    }
  }
  sheet.appendRow(newRow);
  return { ok: true, id: newRow[0] };
}

/** 予定を1件削除する */
function deleteSchedule(id) {
  const sheet = setupSheet_();
  const rowIndex = findRowById_(sheet, id);
  if (rowIndex > 0) sheet.deleteRow(rowIndex);
  return { ok: true };
}

// ===== 祝日（余裕対応：日本の祝日カレンダーを利用） =====

/**
 * 指定した年月に含まれる日本の祝日を { 'yyyy-MM-dd': '祝日名' } で返す。
 * 祝日カレンダーが使えない環境では空オブジェクトを返します（表示は崩れません）。
 */
function getHolidays(year, month) {
  const result = {};
  try {
    const cal = CalendarApp.getCalendarById('ja.japanese#holiday@group.v.calendar.google.com');
    if (!cal) return result;
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1); // 翌月1日まで
    const tz = Session.getScriptTimeZone();
    cal.getEvents(from, to).forEach(ev => {
      const key = Utilities.formatDate(ev.getStartTime(), tz, 'yyyy-MM-dd');
      result[key] = ev.getTitle();
    });
  } catch (e) {
    // 権限が無い等で失敗しても、祝日なしとして続行
  }
  return result;
}

// ===== 共通ヘルパー =====

/** シート上の値（Dateまたは文字列）を 'yyyy-MM-dd' に正規化 */
function toDateStr_(value, tz) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  }
  // 文字列で入っている場合はそのまま先頭10文字を使う
  return String(value).slice(0, 10);
}

/** id から行番号（1始まり）を探す。見つからなければ -1 */
function findRowById_(sheet, id) {
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2; // 見出し行の分 +2
  }
  return -1;
}

/**
 * 初期セットアップ確認用（任意）。
 * スクリプトエディタから実行するとシートを生成し、URLをログに出します。
 */
function init() {
  setupSheet_();
  Logger.log('セットアップ完了: ' + getSpreadsheet_().getUrl());
}

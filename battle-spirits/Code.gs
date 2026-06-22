/**
 * バトルスピリッツ オンライン・プレイマット（GAS・統合版）
 *
 * 主な仕様（改修版）
 *  - カード画像は Drive の「Battle Spirits Images」内の、カードID前半（最初の "-" より前）の
 *    名前のサブフォルダに入れて管理する。例: BS65-001 → フォルダ「BS65」内の BS65-001.*
 *  - カードの裏面は「Battle Spirits Images/back/back.png」を使う。
 *  - 契約カードは「Contracts」シートにカードIDを列挙して判定する。
 *  - 画像はクライアントが必要なものだけ getCardImages でまとめて取得する（遅延読み込み）。
 */

var PROP_SS_ID = 'BS_SPREADSHEET_ID';
var DB_SHEET = 'DB';
var CARDS_SHEET = 'Cards';
var CONFIG_SHEET = 'Config';
var COLLECTIONS_SHEET = 'Collections';
var CONTRACTS_SHEET = 'Contracts';
var STATE_CELL = 'A1';

var IMAGE_ROOT_NAME = 'Battle Spirits Images';
var BACK_FOLDER_NAME = 'back';
var BACK_FILE_NAME = 'back';

var ZONES_LOOSE = ['deck', 'hand', 'trash', 'removed', 'burst', 'reveal'];
var PHASES = ['start', 'core', 'draw', 'refresh', 'main', 'attack', 'end'];

var CARD_COLUMNS = [
  'id', 'name', 'type', 'color', 'cost', 'reduction',
  'symbols', 'bp', 'level', 'effect', 'imageUrl', 'tags', 'contract'
];

/** 真偽値として扱う（チェックボックスや「1」「契約」等を true 扱い）。 */
function isTruthy_(v) {
  if (v === true) return true;
  if (v == null) return false;
  var s = String(v).trim().toLowerCase();
  return s !== '' && s !== 'false' && s !== '0' && s !== 'no' && s !== '×';
}

// ===========================================================================
// Web エントリポイント
// ===========================================================================

function doGet(e) {
  ensureStorage_();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Battle Spirits Playmat')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ===========================================================================
// ストレージ（スプレッドシート）
// ===========================================================================

function ensureStorage_() {
  var props = PropertiesService.getScriptProperties();
  var ss = null;

  // コンテナバインド（このスクリプトがスプレッドシートに紐づく）なら、その自身を使う。
  try {
    var bound = SpreadsheetApp.getActiveSpreadsheet();
    if (bound) { ss = bound; props.setProperty(PROP_SS_ID, ss.getId()); }
  } catch (err) { /* スタンドアロン時は無視 */ }

  if (!ss) {
    var id = props.getProperty(PROP_SS_ID);
    if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e2) { ss = null; } }
    if (!ss) { ss = SpreadsheetApp.create('Battle Spirits Data'); props.setProperty(PROP_SS_ID, ss.getId()); }
  }

  if (!ss.getSheetByName(DB_SHEET)) {
    ss.insertSheet(DB_SHEET).getRange(STATE_CELL).setValue('');
  }
  if (!ss.getSheetByName(CONFIG_SHEET)) {
    var cfg = ss.insertSheet(CONFIG_SHEET);
    cfg.getRange('A1:B1').setValues([['key', 'value']]);
    cfg.getRange('B2').setNumberFormat('@'); // resetPin の先頭ゼロ消え防止
    cfg.getRange('A2:B3').setValues([
      ['resetPin', '0000'], ['deckMinSize', '40']
    ]);
  }
  if (!ss.getSheetByName(CARDS_SHEET)) seedCardsSheet_(ss);
  else ensureCardColumns_(ss.getSheetByName(CARDS_SHEET));
  if (!ss.getSheetByName(COLLECTIONS_SHEET)) {
    var col = ss.insertSheet(COLLECTIONS_SHEET);
    col.getRange('A1:B1').setValues([['title', 'deckText']]);
    col.setFrozenRows(1);
  }
  if (!ss.getSheetByName(CONTRACTS_SHEET)) {
    var con = ss.insertSheet(CONTRACTS_SHEET);
    con.getRange('A1').setValue('cardId');
    con.setFrozenRows(1);
  }

  // 空のデフォルトシートだけ消す（中身があるシートは消さない）。
  var first = ss.getSheets()[0];
  var fn = first.getName();
  if ((fn === 'シート1' || fn === 'Sheet1') && ss.getSheets().length > 1
      && first.getLastRow() === 0 && first.getLastColumn() === 0) {
    ss.deleteSheet(first);
  }
  return ss;
}

function dataSS_() { return ensureStorage_(); }

function getConfig_() {
  var sh = dataSS_().getSheetByName(CONFIG_SHEET);
  var values = sh.getDataRange().getValues();
  var out = {};
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] !== '') out[String(values[i][0])] = values[i][1];
  }
  return out;
}

function setConfigValue_(key, value) {
  var sh = dataSS_().getSheetByName(CONFIG_SHEET);
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === key) { sh.getRange(i + 1, 2).setValue(value); return; }
  }
  sh.appendRow([key, value]);
}

function loadState_() {
  var raw = dataSS_().getSheetByName(DB_SHEET).getRange(STATE_CELL).getValue();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (err) { return null; }
}

function saveState_(state) {
  dataSS_().getSheetByName(DB_SHEET).getRange(STATE_CELL).setValue(JSON.stringify(state));
}

function withState_(mutator) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var state = loadState_();
    if (!state) throw new Error('ゲームがまだ開始されていません。「設定」タブで初期化してください。');
    var next = mutator(state) || state;
    next.updatedAt = Date.now();
    saveState_(next);
    return next;
  } finally {
    lock.releaseLock();
  }
}

// ===========================================================================
// 席（プレイヤー）認証
// ===========================================================================

function makeToken_() { return Utilities.getUuid().replace(/-/g, ''); }

function claimSeat(seat, name, token, pin) {
  if (seat !== 'A' && seat !== 'B') throw new Error('席は A か B を指定してください。');
  var result = {};
  withState_(function (state) {
    var s = state.seats[seat];
    var cfg = getConfig_();
    var canTake = !s.claimed || (token && token === s.token) || (pin && String(pin) === String(cfg.resetPin));
    if (!canTake) throw new Error('この席はすでに使用中です。リセットPINを入力すると引き継げます。');
    if (!s.token || (pin && String(pin) === String(cfg.resetPin))) s.token = makeToken_();
    s.claimed = true;
    if (name) s.name = String(name).slice(0, 24);
    result = { seat: seat, token: s.token, name: s.name };
    pushLog_(state, (s.name || seat) + ' が席 ' + seat + ' に着席');
    return state;
  });
  return result;
}

function seatAuthorized_(state, seat, token) {
  if (!seat || (seat !== 'A' && seat !== 'B')) return false;
  return !!token && state.seats[seat] && state.seats[seat].token === token;
}

// ===========================================================================
// カードのマスター情報（表面）
// ===========================================================================

function seedCardsSheet_(ss) {
  var sh = ss.insertSheet(CARDS_SHEET);
  sh.getRange(1, 1, 1, CARD_COLUMNS.length).setValues([CARD_COLUMNS]);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, CARD_COLUMNS.length);
}

/** 既存の Cards シートに不足している列（contract 等）を末尾に追加する。 */
function ensureCardColumns_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h); });
  CARD_COLUMNS.forEach(function (col) {
    if (header.indexOf(col) < 0) {
      sh.getRange(1, header.length + 1).setValue(col);
      header.push(col);
    }
  });
}

function getAllCards() {
  var sh = dataSS_().getSheetByName(CARDS_SHEET);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var header = values[0].map(function (h) { return String(h); });
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row[0] === '' && row[1] === '') continue;
    var obj = {};
    for (var c = 0; c < header.length; c++) obj[header[c]] = row[c] === '' ? '' : row[c];
    obj.id = String(obj.id);
    out.push(obj);
  }
  return out;
}

function getCardMap_() {
  var map = {};
  getAllCards().forEach(function (c) { map[c.id] = c; });
  return map;
}

/** カード名を返す。マスターに無ければ、_b（転醒）の場合は元カードの名前にフォールバック。 */
function cardName_(cardMap, cardId) {
  cardId = String(cardId);
  var c = cardMap[cardId];
  if (c && c.name) return String(c.name);
  if (/_b$/.test(cardId)) {
    var base = cardId.replace(/_b$/, '');
    var bc = cardMap[base];
    if (bc && bc.name) return String(bc.name);
  }
  return cardId;
}

function upsertCard(card) {
  if (!card || !card.id) throw new Error('カードIDは必須です。');
  var sh = dataSS_().getSheetByName(CARDS_SHEET);
  var values = sh.getDataRange().getValues();
  var row = CARD_COLUMNS.map(function (k) { return card[k] != null ? card[k] : ''; });
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]) === String(card.id)) {
      sh.getRange(r + 1, 1, 1, CARD_COLUMNS.length).setValues([row]);
      return { ok: true, updated: true };
    }
  }
  sh.appendRow(row);
  return { ok: true, updated: false };
}

function deleteCard(cardId) {
  var sh = dataSS_().getSheetByName(CARDS_SHEET);
  var values = sh.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]) === String(cardId)) { sh.deleteRow(r + 1); return { ok: true }; }
  }
  return { ok: false };
}

// ===========================================================================
// 契約カード（Contracts シートにカードIDを列挙）
// ===========================================================================

/** Contracts シートのカードID一覧を集合（{id:true}）で返す。 */
function getContractSet_() {
  var sh = dataSS_().getSheetByName(CONTRACTS_SHEET);
  var set = {};
  if (!sh) return set;
  var values = sh.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    var v = String(values[r][0] == null ? '' : values[r][0]).trim();
    if (v) set[v] = true;
  }
  return set;
}

// ===========================================================================
// 画像（Drive のサブフォルダ構成 → base64 データURIで配信）
// ===========================================================================

/** カードIDの前半（最初の "-" より前。無ければ "_" より前）。フォルダ名に使う。 */
function imagePrefix_(cardId) {
  var s = String(cardId);
  var i = s.indexOf('-');
  if (i < 0) i = s.indexOf('_');
  return i > 0 ? s.substring(0, i) : s;
}

/** 拡張子を除いたファイル名。 */
function stripExt_(name) { var s = String(name); var i = s.lastIndexOf('.'); return i > 0 ? s.substring(0, i) : s; }

function getImageRoot_() {
  var it = DriveApp.getFoldersByName(IMAGE_ROOT_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(IMAGE_ROOT_NAME);
}

function getSubfolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : null;
}

/** フォルダ内の画像を {拡張子なしファイル名: File} で索引する。 */
function indexFolderImages_(folder) {
  var map = {};
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    var base = stripExt_(f.getName());
    if (!(base in map)) map[base] = f; // 同名は先勝ち
  }
  return map;
}

function fileToDataUrl_(file) {
  try {
    var blob = file.getBlob();
    return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    return '';
  }
}

/**
 * カードIDの配列に対して {cardId: dataURI} を返す（まとめて取得）。
 * まずプレフィックスのサブフォルダを見て、無ければ安全網（全フォルダを1回だけ索引）で探す。
 */
function getCardImages(cardIds) {
  var out = {};
  if (!cardIds || !cardIds.length) return out;
  var root = getImageRoot_();

  // プレフィックスごとにまとめる。
  var byPrefix = {};
  cardIds.forEach(function (id) {
    id = String(id);
    if (id in out) return;
    out[id] = ''; // 既定（未発見）
    var p = imagePrefix_(id);
    (byPrefix[p] = byPrefix[p] || []).push(id);
  });

  // 安全網：プレフィックスのフォルダに無い場合に備え、全フォルダを1回だけ索引する。
  var globalIdx = null;
  function ensureGlobal() {
    if (globalIdx) return globalIdx;
    globalIdx = {};
    var merge = function (idx) { Object.keys(idx).forEach(function (k) { if (!(k in globalIdx)) globalIdx[k] = idx[k]; }); };
    merge(indexFolderImages_(root));
    var fs = root.getFolders();
    while (fs.hasNext()) merge(indexFolderImages_(fs.next()));
    return globalIdx;
  }

  Object.keys(byPrefix).forEach(function (p) {
    var sub = getSubfolder_(root, p);
    var idx = sub ? indexFolderImages_(sub) : null;
    byPrefix[p].forEach(function (id) {
      var f = idx ? idx[id] : null;
      if (!f) f = ensureGlobal()[id] || null;
      if (f) out[id] = fileToDataUrl_(f);
    });
  });
  return out;
}

/** 1枚だけ取得（プレビュー等）。 */
function getCardImage(cardId) {
  var m = getCardImages([cardId]);
  return m[String(cardId)] || '';
}

/** カード裏面（back/back.png）の dataURI。 */
function getBackImage() {
  var root = getImageRoot_();
  var sub = getSubfolder_(root, BACK_FOLDER_NAME);
  var folder = sub || root;
  var idx = indexFolderImages_(folder);
  var f = idx[BACK_FILE_NAME];
  if (!f) {
    // フォルダ内に1枚だけ入れる運用なので、見つからなければ先頭の画像を使う。
    var it = folder.getFiles();
    if (it.hasNext()) f = it.next();
  }
  return f ? fileToDataUrl_(f) : '';
}

// ===========================================================================
// コレクション（デッキレシピの保存）
// ===========================================================================

function getCollections() {
  var sh = dataSS_().getSheetByName(COLLECTIONS_SHEET);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < values.length; r++) {
    if (values[r][0] === '') continue;
    out.push({ title: String(values[r][0]), deckText: String(values[r][1] || '') });
  }
  return out;
}

function upsertCollection(title, deckText) {
  title = String(title || '').trim();
  if (!title) throw new Error('タイトルは必須です。');
  var sh = dataSS_().getSheetByName(COLLECTIONS_SHEET);
  var values = sh.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]) === title) {
      sh.getRange(r + 1, 1, 1, 2).setValues([[title, deckText || '']]);
      return { ok: true, updated: true };
    }
  }
  sh.appendRow([title, deckText || '']);
  return { ok: true, updated: false };
}

function deleteCollection(title) {
  var sh = dataSS_().getSheetByName(COLLECTIONS_SHEET);
  var values = sh.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]) === String(title)) { sh.deleteRow(r + 1); return { ok: true }; }
  }
  return { ok: false };
}

// ===========================================================================
// ゲーム状態の生成・リセット
// ===========================================================================

function emptyPlayer_() {
  return {
    deck: [], hand: [], trash: [], removed: [], burst: [], reveal: [],
    life: { normal: 0, soul: 0 }, reserve: { normal: 0, soul: 0 },
    trashCore: { normal: 0, soul: 0 }, count: { normal: 0, soul: 0 }, field: [],
    decklist: [], deckSubmitted: false, dealt: false, contractName: ''
  };
}

function emptyState_() {
  return {
    version: 3, createdAt: Date.now(), updatedAt: Date.now(),
    seq: 1, phase: 'start', turn: 1, activeSeat: 'A', firstTurnDone: false,
    seats: {
      A: { name: 'プレイヤーA', token: '', claimed: false },
      B: { name: 'プレイヤーB', token: '', claimed: false }
    },
    players: { A: emptyPlayer_(), B: emptyPlayer_() },
    log: []
  };
}

function createGame(pin) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var existing = loadState_();
    if (existing) {
      var cfg = getConfig_();
      if (String(pin) !== String(cfg.resetPin)) throw new Error('リセットPINが違います。');
    }
    var state = emptyState_();
    pushLog_(state, 'ゲームを初期化しました');
    saveState_(state);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function gameExists() { return { exists: !!loadState_() }; }

function pushLog_(state, msg) {
  state.log = state.log || [];
  state.log.push(Utilities.formatDate(new Date(), 'Asia/Tokyo', 'HH:mm:ss') + '  ' + msg);
  if (state.log.length > 300) state.log = state.log.slice(-300);
}

function seatAction_(seat, token, mutator) {
  return withState_(function (state) {
    if (!seatAuthorized_(state, seat, token)) throw new Error('認証エラー: もう一度着席し直してください。');
    mutator(state, state.players[seat], seat);
    return state;
  });
}

function newIid_(state) { return 'c' + (state.seq++); }

// ===========================================================================
// デッキ構築・配布
// ===========================================================================

function submitDeck(seat, token, decklist) {
  return seatAction_(seat, token, function (state, player) {
    var deck = [];
    (decklist || []).forEach(function (entry) {
      var n = Math.max(0, parseInt(entry.count, 10) || 0);
      for (var i = 0; i < n; i++) deck.push({ iid: newIid_(state), cardId: String(entry.cardId) });
    });
    player.deck = deck;
    player.decklist = decklist || [];
    player.deckSubmitted = true;
    player.dealt = false;
    pushLog_(state, state.seats[seat].name + ' がデッキ(' + deck.length + '枚)を提出');
  });
}

function dealStart(seat, token) {
  var cardMap = getCardMap_();
  var contractSet = getContractSet_();
  return seatAction_(seat, token, function (state, player) {
    if (!player.deck.length) throw new Error('先にデッキを提出してください。');
    shuffleArray_(player.deck);
    player.life = { normal: 5, soul: 0 };
    player.reserve = { normal: 3, soul: 1 };
    player.count = { normal: 0, soul: 0 };
    player.trashCore = { normal: 0, soul: 0 };
    player.hand = []; player.trash = []; player.removed = [];
    player.burst = []; player.reveal = []; player.field = [];
    player.contractName = '';

    // デッキ中の契約カード（Contracts シートで判定）を探す。
    var contractIdx = -1, contractIds = {};
    for (var i = 0; i < player.deck.length; i++) {
      if (contractSet[player.deck[i].cardId]) {
        if (contractIdx < 0) contractIdx = i;
        contractIds[player.deck[i].cardId] = true;
      }
    }

    if (contractIdx >= 0) {
      // 契約カードを1枚だけ手札へ → 残り3枚は「契約カード以外」からランダムに（シャッフル済みの上から）。
      var contractCard = player.deck.splice(contractIdx, 1)[0];
      player.hand.push(contractCard);
      var need = 3, j = 0;
      while (need > 0 && j < player.deck.length) {
        if (!contractSet[player.deck[j].cardId]) {
          player.hand.push(player.deck.splice(j, 1)[0]);
          need--;
        } else {
          j++;
        }
      }
      player.contractName = cardName_(cardMap, contractCard.cardId);
      pushLog_(state, state.seats[seat].name + ' が開始処理（契約カード『' + player.contractName + '』＋契約以外からランダム3枚）');
      if (Object.keys(contractIds).length >= 2) {
        pushLog_(state, '⚠ ' + state.seats[seat].name + ' のデッキに異なる契約カードが複数検出されました（ルール違反の可能性）');
      }
    } else {
      for (var k = 0; k < 4 && player.deck.length; k++) player.hand.push(player.deck.shift());
      pushLog_(state, state.seats[seat].name + ' が開始処理（シャッフル・ライフ5・リザーブ4・4枚ドロー）');
    }
    player.dealt = true;
  });
}

// ===========================================================================
// ステップの定型処理（補助）
// ===========================================================================

function refreshStep(seat, token) {
  return seatAction_(seat, token, function (state, player) {
    var recovered = 0, stepped = 0;
    player.field.forEach(function (perm) {
      if (perm.state === 'heavy') { perm.state = 'rested'; stepped++; }
      else if (perm.state === 'rested') { perm.state = 'active'; recovered++; }
    });
    var tc = player.trashCore || { normal: 0, soul: 0 };
    var movedNormal = tc.normal, movedSoul = tc.soul === 1;
    if (movedNormal > 0 || movedSoul) {
      player.reserve.normal += movedNormal;
      if (movedSoul) player.reserve.soul = 1;
      player.trashCore = { normal: 0, soul: 0 };
    }
    pushLog_(state, state.seats[seat].name + ' がリフレッシュ（回復' + recovered +
      '・重疲労→疲労' + stepped + '・トラッシュのコア' + (movedNormal + (movedSoul ? 1 : 0)) + '個をリザーブへ）');
  });
}

function coreStep(seat, token) {
  return seatAction_(seat, token, function (state, player) {
    player.reserve.normal += 1;
    pushLog_(state, state.seats[seat].name + ' がコアステップ（ボイド→リザーブ 1個）');
  });
}

function recoverAll(seat, token) {
  return seatAction_(seat, token, function (state, player) {
    var n = 0;
    player.field.forEach(function (perm) { if (perm.state !== 'active') { perm.state = 'active'; n++; } });
    pushLog_(state, state.seats[seat].name + ' が自分のカードを全回復（' + n + '体）');
  });
}

/** 場のカードを格子状に並べ直す（視認性向上）。 */
function tidyField(seat, token, cols) {
  cols = Math.max(1, parseInt(cols, 10) || 4);
  return seatAction_(seat, token, function (state, player) {
    var w = 150, h = 230, padX = 10, padY = 64;
    player.field.forEach(function (perm, i) {
      perm.x = padX + (i % cols) * w;
      perm.y = padY + Math.floor(i / cols) * h;
    });
    pushLog_(state, state.seats[seat].name + ' が場のカードを整列');
  });
}

// ===========================================================================
// デッキ操作
// ===========================================================================

function shuffleArray_(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
}

function shuffleDeck(seat, token) {
  return seatAction_(seat, token, function (state, player) {
    shuffleArray_(player.deck);
    pushLog_(state, state.seats[seat].name + ' がデッキをシャッフル');
  });
}

function drawCards(seat, token, n, reveal, fromBottom) {
  n = Math.max(1, parseInt(n, 10) || 1);
  return seatAction_(seat, token, function (state, player) {
    var drawn = 0;
    for (var i = 0; i < n && player.deck.length; i++) {
      var c = fromBottom ? player.deck.pop() : player.deck.shift();
      if (reveal) player.reveal.push(c); else player.hand.push(c);
      drawn++;
    }
    pushLog_(state, state.seats[seat].name + ' が' + (reveal ? '公開' : '') +
      (fromBottom ? 'デッキの下から' : '') + 'ドロー ' + drawn + '枚');
    if (!player.deck.length) pushLog_(state, '⚠ ' + state.seats[seat].name + ' のデッキが0枚です');
  });
}

function searchDeck(seat, token) {
  var result;
  withState_(function (state) {
    if (!seatAuthorized_(state, seat, token)) throw new Error('認証エラー。');
    var cardMap = getCardMap_();
    result = state.players[seat].deck.map(function (c) {
      return { iid: c.iid, cardId: c.cardId, name: cardName_(cardMap, c.cardId) };
    });
    // 不正防止：デッキを覗いたことを記録する。
    pushLog_(state, '👁 ' + state.seats[seat].name + ' がデッキを確認/サーチ（中身を閲覧）');
    return state;
  });
  return result;
}

/** 山札の上から n 枚をトラッシュ（カード）へ直接破棄する。 */
function millDeck(seat, token, n) {
  n = Math.max(1, parseInt(n, 10) || 1);
  return seatAction_(seat, token, function (state, player) {
    var moved = 0;
    for (var i = 0; i < n && player.deck.length; i++) { player.trash.push(player.deck.shift()); moved++; }
    pushLog_(state, state.seats[seat].name + ' が山札の上から ' + moved + ' 枚をトラッシュへ破棄');
    if (!player.deck.length) pushLog_(state, '⚠ ' + state.seats[seat].name + ' のデッキが0枚です');
  });
}

// ===========================================================================
// カードのゾーン間移動
// ===========================================================================

function findLooseIndex_(list, iid) {
  for (var i = 0; i < list.length; i++) if (list[i].iid === iid) return i;
  return -1;
}

function insertAt_(list, card, position) {
  if (position === 'top') list.unshift(card);
  else if (position === 'bottom' || position == null) list.push(card);
  else { var i = parseInt(position, 10); if (isNaN(i)) list.push(card); else list.splice(i, 0, card); }
}

function moveCard(seat, token, iid, fromZone, toZone, position) {
  if (ZONES_LOOSE.indexOf(fromZone) < 0 || ZONES_LOOSE.indexOf(toZone) < 0) throw new Error('不正なゾーン指定です。');
  return seatAction_(seat, token, function (state, player) {
    var src = player[fromZone];
    var idx = findLooseIndex_(src, iid);
    if (idx < 0) throw new Error('カードが見つかりません。');
    insertAt_(player[toZone], src.splice(idx, 1)[0], position);
    pushLog_(state, state.seats[seat].name + ' : ' + zoneLabel_(fromZone) + ' → ' + zoneLabel_(toZone) + posLabel_(toZone, position));
  });
}

function playToField(seat, token, iid, fromZone) {
  if (ZONES_LOOSE.indexOf(fromZone) < 0) throw new Error('不正なゾーン指定です。');
  return seatAction_(seat, token, function (state, player) {
    var src = player[fromZone];
    var idx = findLooseIndex_(src, iid);
    if (idx < 0) throw new Error('カードが見つかりません。');
    var card = src.splice(idx, 1)[0];
    player.field.push({
      pid: 'p' + (state.seq++), base: card, braves: [], under: [],
      cores: { normal: 0, soul: 0 }, level: 1, state: 'active',
      x: 12 + (player.field.length % 6) * 150, y: 64 + Math.floor(player.field.length / 6) * 70, note: ''
    });
    pushLog_(state, state.seats[seat].name + ' がフィールドにカードを配置');
  });
}

function findPerm_(player, pid) {
  for (var i = 0; i < player.field.length; i++) if (player.field[i].pid === pid) return player.field[i];
  return null;
}

function findPermIndex_(player, pid) {
  for (var i = 0; i < player.field.length; i++) if (player.field[i].pid === pid) return i;
  return -1;
}

/** 手札等のカードをブレイヴ/カードとして合体（場のカードへ重ねる）。 */
function attachBrave(seat, token, iid, fromZone, targetPid) {
  if (ZONES_LOOSE.indexOf(fromZone) < 0) throw new Error('不正なゾーン指定です。');
  return seatAction_(seat, token, function (state, player) {
    var perm = findPerm_(player, targetPid);
    if (!perm) throw new Error('合体先が見つかりません。');
    var src = player[fromZone];
    var idx = findLooseIndex_(src, iid);
    if (idx < 0) throw new Error('カードが見つかりません。');
    perm.braves = perm.braves || [];
    perm.braves.push(src.splice(idx, 1)[0]);
    pushLog_(state, state.seats[seat].name + ' がブレイヴ/カードを合体');
  });
}

/** 場のカード（ブレイヴ）を別の場のカードに合体する。コアは合体先へ移す。 */
function mergeBrave(seat, token, sourcePid, targetPid) {
  return seatAction_(seat, token, function (state, player) {
    if (sourcePid === targetPid) throw new Error('同じカードには合体できません。');
    var target = findPerm_(player, targetPid);
    if (!target) throw new Error('合体先が見つかりません。');
    var sIdx = findPermIndex_(player, sourcePid);
    if (sIdx < 0) throw new Error('合体するカードが見つかりません。');
    var source = player.field.splice(sIdx, 1)[0];
    target.braves = target.braves || [];
    target.braves.push(source.base);
    // 連鎖していたブレイヴ・下に重ねていたカードも失わないよう引き継ぐ。
    (source.braves || []).forEach(function (b) { target.braves.push(b); });
    (source.under || []).forEach(function (u) { target.braves.push(u); });
    // ブレイヴはコアを持たないので、載っていたコアは合体先へ移す。
    target.cores.normal += (source.cores && source.cores.normal) || 0;
    if (source.cores && source.cores.soul) target.cores.soul = 1;
    var cm = getCardMap_();
    pushLog_(state, state.seats[seat].name + ' が『' + cardName_(cm, source.base.cardId) +
      '』を合体（→ ' + cardName_(cm, target.base.cardId) + '）');
  });
}

function detachBrave(seat, token, pid, braveIndex) {
  return seatAction_(seat, token, function (state, player) {
    var perm = findPerm_(player, pid);
    if (!perm) throw new Error('対象が見つかりません。');
    var bi = parseInt(braveIndex, 10);
    if (isNaN(bi) || bi < 0 || bi >= perm.braves.length) throw new Error('ブレイヴが見つかりません。');
    var brave = perm.braves.splice(bi, 1)[0];
    player.field.push({
      pid: 'p' + (state.seq++), base: brave, braves: [], under: [],
      cores: { normal: 0, soul: 0 }, level: 1, state: 'active', x: perm.x + 30, y: perm.y + 30, note: ''
    });
    pushLog_(state, state.seats[seat].name + ' がブレイヴを分離');
  });
}

/** 煌臨：手札等のカードを場のカードへ重ね、前面を新カードに、コアは前面へ集約する。 */
function kourin(seat, token, iid, fromZone, targetPid) {
  if (ZONES_LOOSE.indexOf(fromZone) < 0) throw new Error('不正なゾーン指定です。');
  return seatAction_(seat, token, function (state, player) {
    var perm = findPerm_(player, targetPid);
    if (!perm) throw new Error('煌臨先が見つかりません。');
    var src = player[fromZone];
    var idx = findLooseIndex_(src, iid);
    if (idx < 0) throw new Error('カードが見つかりません。');
    var card = src.splice(idx, 1)[0];
    perm.under = perm.under || [];
    perm.under.push(perm.base);   // これまでの前面カードを下に重ねる
    perm.base = card;             // 新しいカードが前面（コアはそのまま前面に集約される）
    pushLog_(state, state.seats[seat].name + ' が煌臨（『' +
      cardName_(getCardMap_(), card.cardId) + '』を重ねる）');
  });
}

/** 転醒/取消：場のカードのIDに「_b」を付け外しして反対の面を表示する。 */
function flipCard(seat, token, pid) {
  return seatAction_(seat, token, function (state, player) {
    var perm = findPerm_(player, pid);
    if (!perm) throw new Error('対象が見つかりません。');
    var id = String(perm.base.cardId), nid, label;
    if (/_b$/.test(id)) { nid = id.replace(/_b$/, ''); label = '転醒を取消'; }
    else { nid = id + '_b'; label = '転醒'; }
    perm.base.cardId = nid;
    pushLog_(state, state.seats[seat].name + ' がカードを' + label + '（' + id + ' → ' + nid + '）');
  });
}

function setPermanentState(seat, token, pid, newState) {
  if (['active', 'rested', 'heavy'].indexOf(newState) < 0) throw new Error('不正な状態です。');
  return seatAction_(seat, token, function (state, player) {
    var perm = findPerm_(player, pid);
    if (!perm) throw new Error('対象が見つかりません。');
    perm.state = newState;
  });
}

function updatePermanent(seat, token, pid, patch) {
  return seatAction_(seat, token, function (state, player) {
    var perm = findPerm_(player, pid);
    if (!perm) throw new Error('対象が見つかりません。');
    if (patch.x != null) perm.x = Math.round(patch.x);
    if (patch.y != null) perm.y = Math.round(patch.y);
    if (patch.level != null) perm.level = parseInt(patch.level, 10) || 1;
    if (patch.note != null) perm.note = String(patch.note).slice(0, 60);
  });
}

function removePermanent(seat, token, pid, baseTo, bravesTo, coresTo, deckPos) {
  baseTo = baseTo || 'trash';
  bravesTo = bravesTo || baseTo;
  coresTo = coresTo || 'reserve';
  return seatAction_(seat, token, function (state, player) {
    var idx = findPermIndex_(player, pid);
    if (idx < 0) throw new Error('対象が見つかりません。');
    var perm = player.field.splice(idx, 1)[0];
    moveCorePile_(perm.cores, getPile_(player, coresTo), perm.cores.normal, perm.cores.soul === 1);
    insertAt_(player[baseTo], perm.base, baseTo === 'deck' ? deckPos : 'bottom');
    // 煌臨で下に重ねていたカードも前面と同じ行き先へ。
    (perm.under || []).forEach(function (u) { insertAt_(player[baseTo], u, baseTo === 'deck' ? deckPos : 'bottom'); });
    (perm.braves || []).forEach(function (b) { insertAt_(player[bravesTo], b, bravesTo === 'deck' ? deckPos : 'bottom'); });
    pushLog_(state, state.seats[seat].name + ' : 場のカードを ' + zoneLabel_(baseTo) + ' へ（コアは' + coreDestLabel_(coresTo) + '）');
  });
}

// ===========================================================================
// コア管理
// ===========================================================================

function getPile_(player, ref) {
  if (ref === 'void') return null;
  if (ref === 'reserve') return player.reserve;
  if (ref === 'life') return player.life;
  if (ref === 'count') { if (!player.count) player.count = { normal: 0, soul: 0 }; return player.count; }
  if (ref === 'trash') { if (!player.trashCore) player.trashCore = { normal: 0, soul: 0 }; return player.trashCore; }
  if (ref && ref.indexOf('perm:') === 0) { var perm = findPerm_(player, ref.substring(5)); return perm ? perm.cores : null; }
  return null;
}

function moveCorePile_(fromPile, toPile, normalAmount, includeSoul) {
  normalAmount = Math.max(0, parseInt(normalAmount, 10) || 0);
  // ソウルコアの妥当性チェックを先に行い、不正なら何も動かさずに失敗させる。
  if (includeSoul) {
    if (!fromPile) throw new Error('ボイドからソウルコアは取り出せません。');
    if (fromPile.soul !== 1) throw new Error('そこにソウルコアはありません。');
    // toPile が null（ボイド）でも可：ソウルコアをボイドへ送れる（ソウルドライブ等の除外相当）。
  }
  if (fromPile) { normalAmount = Math.min(normalAmount, fromPile.normal); fromPile.normal -= normalAmount; }
  if (toPile) toPile.normal += normalAmount;
  if (includeSoul) { fromPile.soul = 0; if (toPile) toPile.soul = 1; }
}

function moveCore(seat, token, fromRef, toRef, amount, soul) {
  return seatAction_(seat, token, function (state, player) {
    var fromPile = getPile_(player, fromRef);
    var toPile = getPile_(player, toRef);
    if (fromRef !== 'void' && !fromPile) throw new Error('移動元が不正です。');
    if (toRef !== 'void' && !toPile) throw new Error('移動先が不正です。');
    moveCorePile_(fromPile, toPile, amount, !!soul);
    pushLog_(state, state.seats[seat].name + ' : コア ' + (amount || 0) + (soul ? '+ソウル' : '') +
      ' を ' + coreDestLabel_(fromRef) + ' → ' + coreDestLabel_(toRef));
    if (fromRef === 'life') {
      var lifeTotal = player.life.normal + (player.life.soul ? 1 : 0);
      if (player.dealt && lifeTotal === 0) pushLog_(state, '🏁 ' + state.seats[seat].name + ' のライフが0になりました（敗北条件）');
    }
  });
}

// ===========================================================================
// ターン・フェイズ
// ===========================================================================

function setPhase(seat, token, phase) {
  return seatAction_(seat, token, function (state) {
    if (PHASES.indexOf(phase) < 0) throw new Error('不正なフェイズです。');
    state.phase = phase;
    pushLog_(state, 'フェイズ: ' + phaseLabel_(phase));
  });
}

function passTurn_(state) {
  state.activeSeat = state.activeSeat === 'A' ? 'B' : 'A';
  state.turn += 1;
  state.phase = 'start';
  state.firstTurnDone = true;
  pushLog_(state, '=== ターン' + state.turn + ' : ' + state.seats[state.activeSeat].name + ' の番 ===');
}

function passTurn(seat, token) { return seatAction_(seat, token, function (state) { passTurn_(state); }); }

function setActiveSeat(seat, token, target) {
  return seatAction_(seat, token, function (state) {
    if (target !== 'A' && target !== 'B') throw new Error('不正な席です。');
    state.activeSeat = target;
    pushLog_(state, 'ターンプレイヤーを ' + state.seats[target].name + ' に変更');
  });
}

/** 先攻・後攻を完全ランダムに抽選して決定する（毎回ランダム）。 */
function decideFirst(seat, token) {
  return seatAction_(seat, token, function (state) {
    var first = Math.random() < 0.5 ? 'A' : 'B';
    var second = first === 'A' ? 'B' : 'A';
    state.activeSeat = first;
    state.turn = 1;
    state.phase = 'start';
    state.firstTurnDone = false;
    pushLog_(state, '🎲 完全ランダムな抽選の結果、先攻後攻が決定：先攻=' +
      state.seats[first].name + ' / 後攻=' + state.seats[second].name);
  });
}

// ===========================================================================
// 状態取得（隠匿情報フィルタ）
// ===========================================================================

function getState(seat, token) {
  var state = loadState_();
  if (!state) return { exists: false };
  var cardMap = getCardMap_();
  var you = seatAuthorized_(state, seat, token) ? seat : null;

  function pileCount(p) { return { normal: p.normal || 0, soul: p.soul || 0 }; }

  function viewPlayer(pSeat) {
    var p = state.players[pSeat];
    var isOwner = (pSeat === you);
    var v = {
      seat: pSeat, name: state.seats[pSeat].name, claimed: state.seats[pSeat].claimed,
      life: pileCount(p.life), reserve: pileCount(p.reserve),
      count: pileCount(p.count || { normal: 0, soul: 0 }),
      trashCore: pileCount(p.trashCore || { normal: 0, soul: 0 }),
      contractName: p.contractName || '',
      field: p.field.map(function (perm) { return decoratePerm_(perm, cardMap); }),
      trash: p.trash.map(function (c) { return decorateCard_(c, cardMap); }),
      removed: p.removed.map(function (c) { return decorateCard_(c, cardMap); }),
      reveal: p.reveal.map(function (c) { return decorateCard_(c, cardMap); }),
      handCount: p.hand.length, deckCount: p.deck.length, burstCount: p.burst.length,
      started: !!p.dealt,
      lifeZero: !!p.dealt && (p.life.normal + (p.life.soul ? 1 : 0) === 0),
      deckZero: !!p.dealt && p.deck.length === 0
    };
    if (isOwner) {
      v.hand = p.hand.map(function (c) { return decorateCard_(c, cardMap); });
      v.burst = p.burst.map(function (c) { return decorateCard_(c, cardMap); });
    }
    return v;
  }

  return {
    exists: true, you: you, phase: state.phase, turn: state.turn,
    activeSeat: state.activeSeat, firstTurnDone: state.firstTurnDone,
    seats: {
      A: { name: state.seats.A.name, claimed: state.seats.A.claimed },
      B: { name: state.seats.B.name, claimed: state.seats.B.claimed }
    },
    players: { A: viewPlayer('A'), B: viewPlayer('B') },
    log: state.log.slice(-60), updatedAt: state.updatedAt
  };
}

function decorateCard_(c, cardMap) {
  return {
    iid: c.iid, cardId: String(c.cardId), name: cardName_(cardMap, c.cardId)
  };
}

function decoratePerm_(perm, cardMap) {
  return {
    pid: perm.pid, base: decorateCard_(perm.base, cardMap),
    braves: (perm.braves || []).map(function (b) { return decorateCard_(b, cardMap); }),
    under: (perm.under || []).map(function (u) { return decorateCard_(u, cardMap); }),
    cores: { normal: perm.cores.normal || 0, soul: perm.cores.soul || 0 },
    level: perm.level, state: perm.state, x: perm.x, y: perm.y, note: perm.note || ''
  };
}

// ===========================================================================
// ラベル
// ===========================================================================

function zoneLabel_(z) {
  return ({ deck: '山札', hand: '手札', trash: 'トラッシュ', removed: '除外', burst: 'バースト', reveal: '公開', field: 'フィールド' })[z] || z;
}
function posLabel_(zone, pos) {
  if (zone !== 'deck') return '';
  if (pos === 'top') return '(上)';
  if (pos === 'bottom') return '(下)';
  return '';
}
function coreDestLabel_(ref) {
  if (ref === 'void') return 'ボイド';
  if (ref === 'reserve') return 'リザーブ';
  if (ref === 'life') return 'ライフ';
  if (ref === 'count') return 'カウント';
  if (ref === 'trash') return 'トラッシュ';
  if (ref && ref.indexOf('perm:') === 0) return '場のカード';
  return ref;
}
function phaseLabel_(p) {
  return ({ start: 'スタート', core: 'コア', draw: 'ドロー', refresh: 'リフレッシュ', main: 'メイン', attack: 'アタック', end: 'エンド' })[p] || p;
}

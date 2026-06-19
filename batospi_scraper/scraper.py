#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
バトルスピリッツ公式カードリストから
  カードID（例: BS01-001） と カード名
を取得し、Googleスプレッドシートに「2列」で書き込むスクリプト。

対象サイト: https://www.battlespirits.com/cardlist/
出力先   : Googleスプレッドシート（gspread 経由で直接書き込み）

------------------------------------------------------------------
■ セットアップ
    pip install -r requirements.txt

    # JavaScript描画ページを取る場合のみ（後述）
    pip install playwright
    playwright install chromium

■ Google スプレッドシート連携の準備（サービスアカウント方式）
    1. Google Cloud で「Google Sheets API」「Google Drive API」を有効化
    2. サービスアカウントを作成し、JSONキーをダウンロード
       -> このフォルダに credentials.json として保存
    3. 書き込みたいスプレッドシートを、サービスアカウントの
       メールアドレス（xxx@xxx.iam.gserviceaccount.com）に「編集者」で共有
    4. 下の CONFIG の SPREADSHEET_NAME / SPREADSHEET_KEY を設定

■ 実行
    python scraper.py
------------------------------------------------------------------

注意:
  公式サイトのHTML構造は変わることがあります。取得が0件になる場合は
  parse_cards_from_html() のセレクタ部分（下のコメント参照）を実際の
  ページに合わせて調整してください。
"""

import re
import sys
import time
import argparse
from dataclasses import dataclass

import requests
from bs4 import BeautifulSoup

# ============================================================
# CONFIG : 環境に合わせて変更してください
# ============================================================
CONFIG = {
    # 取得したいセット（弾）コード。公式の番号体系に合わせて足してください。
    #   例: BS01, BS02, ... / コラボ等は別体系の場合あり
    "sets": ["BS01", "BS02", "BS03"],

    # 1セットあたり最大何番まで試すか（001〜この数字まで）
    "max_no_per_set": 200,

    # 連続でこの回数ヒットしなかったらそのセットは打ち切り
    "miss_limit": 8,

    # リクエスト間隔（秒）。サーバ負荷をかけないため必ず空ける。
    "sleep_sec": 1.0,

    # JavaScriptで描画されるページの場合 True にして Playwright を使う
    "use_playwright": False,

    # --- 出力先(Googleスプレッドシート) ---
    # 認証JSONキーのパス
    "credentials_json": "credentials.json",
    # スプレッドシート名 か キー(URLの /d/ と /edit の間) のどちらかを指定。
    # KEY を優先して使います。
    "spreadsheet_name": "バトスピ カードリスト",
    "spreadsheet_key": "",   # 例: "1AbCdEf...."（空なら name を使う）
    "worksheet_title": "cards",
}

# カードID の正規表現（BS01-001 / SD01-001 / CB01-001 などにも対応）
CARD_ID_RE = re.compile(r"\b([A-Z]{2,3}\d{2}-\d{3})\b")

# 公式カード詳細ページ URL（カード番号で参照）
DETAIL_URL = "https://www.battlespirits.com/cardlist/?cardno={card_no}"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "ja,en;q=0.8",
}


@dataclass
class Card:
    card_id: str
    name: str


# ============================================================
# HTML取得
# ============================================================
def fetch_html_requests(url: str) -> str:
    """requests で HTML を取得（静的ページ用）。"""
    resp = requests.get(url, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    resp.encoding = resp.apparent_encoding  # 文字化け対策
    return resp.text


_PLAYWRIGHT_PAGE = None


def fetch_html_playwright(url: str) -> str:
    """Playwright で HTML を取得（JavaScript描画ページ用）。
    使うには:  pip install playwright && playwright install chromium
    """
    global _PLAYWRIGHT_PAGE
    if _PLAYWRIGHT_PAGE is None:
        from playwright.sync_api import sync_playwright
        pw = sync_playwright().start()
        browser = pw.chromium.launch()
        _PLAYWRIGHT_PAGE = browser.new_page(extra_http_headers=HEADERS)
    page = _PLAYWRIGHT_PAGE
    page.goto(url, wait_until="networkidle", timeout=30000)
    return page.content()


def fetch_html(url: str) -> str:
    if CONFIG["use_playwright"]:
        return fetch_html_playwright(url)
    return fetch_html_requests(url)


# ============================================================
# パース
# ============================================================
def parse_name_from_detail(html: str, card_id: str) -> str | None:
    """カード詳細ページ HTML から、そのカードIDに対応するカード名を抽出。

    ▼ ここがサイト構造依存ポイント ▼
    公式サイトでは「カード名」が見出し要素に入っていることが多いです。
    まず代表的なパターンを順に試し、ダメなら None を返します。
    実ページを開いて、カード名が入っているタグ/クラスを確認し、
    candidates に追加してください（例: soup.select_one(".cardName")）。
    """
    soup = BeautifulSoup(html, "html.parser")

    candidates = [
        soup.select_one(".cardName"),
        soup.select_one(".card-name"),
        soup.select_one("h1.ttl"),
        soup.select_one("h1"),
        soup.select_one("h2"),
        soup.find("title"),
    ]
    for el in candidates:
        if not el:
            continue
        text = el.get_text(strip=True)
        if not text:
            continue
        # まずカード番号を除去（カード名にも「-」が含まれるため先に消す）
        text = CARD_ID_RE.sub("", text).strip()
        # タイトルに付くサイト名を区切り（| ｜）以降ごと除去。
        # ※「-」は区切りに使わない（火竜星-アーマードラゴン等が切れるため）
        text = re.split(r"\s*[|｜]\s*", text)[0].strip()
        if text and "バトルスピリッツ" not in text:
            return text
    return None


def parse_cards_from_html(html: str) -> list[Card]:
    """一覧ページ HTML から (カードID, カード名) のペアをまとめて抽出。

    一覧ページをスクレイピングする場合に使います（detail方式を使わない場合）。
    ▼ サイト構造依存ポイント ▼ : 1枚分のまとまり要素を選び、その中から
    ID と 名前を取り出します。実ページに合わせて調整してください。
    """
    soup = BeautifulSoup(html, "html.parser")
    cards: list[Card] = []

    # 例: 各カードが <li class="card"> ... </li> のような構造を想定
    for box in soup.select("li.card, .cardBox, .card-item"):
        text = box.get_text(" ", strip=True)
        m = CARD_ID_RE.search(text)
        if not m:
            continue
        card_id = m.group(1)
        name_el = box.select_one(".cardName, .card-name, .name")
        name = name_el.get_text(strip=True) if name_el else None
        if not name:
            # 名前タグが特定できない場合はIDを除いた残りテキストを名前候補に
            name = CARD_ID_RE.sub("", text).strip()
        cards.append(Card(card_id, name))

    # 一覧構造が掴めなかった場合の最終フォールバック:
    # ページ全体からID出現箇所の近傍テキストを拾う
    if not cards:
        for m in CARD_ID_RE.finditer(html):
            cards.append(Card(m.group(1), ""))
    return cards


# ============================================================
# 収集ロジック（詳細ページを番号順にたどる方式）
# ============================================================
def collect_by_detail_pages() -> list[Card]:
    results: list[Card] = []
    for set_code in CONFIG["sets"]:
        print(f"[set] {set_code} を収集中...", file=sys.stderr)
        miss = 0
        for no in range(1, CONFIG["max_no_per_set"] + 1):
            card_id = f"{set_code}-{no:03d}"
            url = DETAIL_URL.format(card_no=card_id)
            try:
                html = fetch_html(url)
            except requests.HTTPError as e:
                miss += 1
                if miss >= CONFIG["miss_limit"]:
                    print(f"  {card_id} まで。打ち切り。", file=sys.stderr)
                    break
                continue
            except Exception as e:  # noqa
                print(f"  取得失敗 {card_id}: {e}", file=sys.stderr)
                miss += 1
                if miss >= CONFIG["miss_limit"]:
                    break
                time.sleep(CONFIG["sleep_sec"])
                continue

            name = parse_name_from_detail(html, card_id)
            if name:
                results.append(Card(card_id, name))
                print(f"  OK {card_id}  {name}", file=sys.stderr)
                miss = 0
            else:
                miss += 1
                if miss >= CONFIG["miss_limit"]:
                    print(f"  {card_id} 付近で打ち切り。", file=sys.stderr)
                    break
            time.sleep(CONFIG["sleep_sec"])
    return results


# ============================================================
# Googleスプレッドシートへ書き込み
# ============================================================
def write_to_gsheet(cards: list[Card]) -> None:
    import gspread
    from google.oauth2.service_account import Credentials

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    creds = Credentials.from_service_account_file(
        CONFIG["credentials_json"], scopes=scopes
    )
    gc = gspread.authorize(creds)

    if CONFIG["spreadsheet_key"]:
        sh = gc.open_by_key(CONFIG["spreadsheet_key"])
    else:
        try:
            sh = gc.open(CONFIG["spreadsheet_name"])
        except gspread.SpreadsheetNotFound:
            sh = gc.create(CONFIG["spreadsheet_name"])
            print(f"新規スプレッドシートを作成: {sh.url}", file=sys.stderr)

    # ワークシート取得 or 作成
    try:
        ws = sh.worksheet(CONFIG["worksheet_title"])
        ws.clear()
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet(
            title=CONFIG["worksheet_title"], rows=len(cards) + 10, cols=2
        )

    rows = [["card_id", "card_name"]]
    rows += [[c.card_id, c.name] for c in cards]
    ws.update(rows, value_input_option="RAW")
    print(f"スプレッドシートに {len(cards)} 件書き込み: {sh.url}", file=sys.stderr)


# ============================================================
# CSVバックアップ（任意・ネット出力前にローカル確認用）
# ============================================================
def write_csv(cards: list[Card], path: str = "cards.csv") -> None:
    import csv
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["card_id", "card_name"])
        for c in cards:
            w.writerow([c.card_id, c.name])
    print(f"CSV出力: {path}", file=sys.stderr)


def main() -> None:
    ap = argparse.ArgumentParser(description="バトスピ公式カードリスト取得")
    ap.add_argument("--csv-only", action="store_true",
                    help="スプレッドシートに書かずCSVだけ出力（動作確認用）")
    args = ap.parse_args()

    cards = collect_by_detail_pages()

    # 重複除去（ID基準）
    seen = {}
    for c in cards:
        seen.setdefault(c.card_id, c)
    cards = sorted(seen.values(), key=lambda x: x.card_id)

    print(f"\n合計 {len(cards)} 件取得しました。", file=sys.stderr)

    write_csv(cards)  # 常にローカルにも残す
    if not args.csv_only:
        write_to_gsheet(cards)


if __name__ == "__main__":
    main()

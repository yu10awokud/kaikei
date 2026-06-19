# バトスピ カードリスト取得スクリプト

バトルスピリッツ公式カードリスト（https://www.battlespirits.com/cardlist/）から
**カードID（例: BS01-001）** と **カード名** を取得し、
Googleスプレッドシートに「2列（card_id / card_name）」で書き込みます。

## セットアップ

```bash
pip install -r requirements.txt
```

### Googleスプレッドシート連携（サービスアカウント方式）

1. Google Cloud で **Google Sheets API** と **Google Drive API** を有効化
2. サービスアカウントを作成 → JSONキーを `credentials.json` としてこのフォルダに保存
3. 書き込み先スプレッドシートを、サービスアカウントのメール
   （`xxx@xxx.iam.gserviceaccount.com`）に **編集者** で共有
4. `scraper.py` の `CONFIG` で `spreadsheet_key`（推奨）または
   `spreadsheet_name` を設定

## 実行

```bash
# まずCSVだけ出して取得内容を確認（ネット出力なし・推奨）
python scraper.py --csv-only

# 問題なければスプレッドシートにも書き込み
python scraper.py
```

## 設定（`scraper.py` の CONFIG）

| キー | 説明 |
|------|------|
| `sets` | 取得する弾コードのリスト（例 `["BS01","BS02"]`） |
| `max_no_per_set` | 各弾で 001〜この番号まで試行 |
| `miss_limit` | 連続ミスがこの回数で打ち切り |
| `sleep_sec` | リクエスト間隔（秒）。サーバ負荷配慮のため必須 |
| `use_playwright` | JavaScript描画ページなら `True` |

## 重要な注意

- **公式サイトのHTML構造に依存します。** 取得が0件・名前が空になる場合は、
  `parse_name_from_detail()`（詳細ページ方式）または
  `parse_cards_from_html()`（一覧方式）内のセレクタを、実際のページに
  合わせて調整してください（コード内に「サイト構造依存ポイント」コメントあり）。
- 公式サイトが JavaScript で描画している場合は `requests` では取れません。
  `pip install playwright && playwright install chromium` の上で
  `CONFIG["use_playwright"] = True` にしてください。
- 取得は必ず間隔を空け、利用規約・robots.txt を尊重してください。

## 開発環境での制約について

このスクリプトはクラウド開発環境のネットワークポリシー上、公式サイトへ
アクセスできない状態で作成されています。パース関数はモックHTMLで動作確認
済みですが、**実サイトのセレクタはローカル実行時に確認・微調整が必要**です。

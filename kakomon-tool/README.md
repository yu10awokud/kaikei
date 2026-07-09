# 過去問 → 問題集PDF 生成ツール（kakomon-tool）

複数年分の「問題のみ」の試験過去問PDFを入力すると、
**問題の忠実な引用 → 生成した解答・解説** という体裁の問題集を
LuaLaTeX できれいなPDFに組み上げるローカルツールです。個人の学習用。

パイプライン:

```
input/*.pdf
   │  split_pdf   PDF → ページ画像（300dpi）
   ▼  work/images/{年度}_p{ページ}.png
   │  extract     Claude Vision(安価モデル)で問題文だけを忠実にJSON化
   ▼  work/extract/{年度}.json
   │  solve       解答・解説を生成 ＋ 2回解いて自己検証（needs_review判定）
   ▼  work/solve/{年度}.json
   │  build_tex   年度→問番順に統合し Jinja2 で .tex 生成（図の切り出し・赤枠）
   ▼  output/mondaishu.tex
   │  compile     lualatex ×2
   ▼  output/mondaishu.pdf
```

## 前提環境

- OS: Windows / TeX Live 2025（LuaLaTeX = `lualatex`）
- 日本語組版: jlreq + luatexja-fontspec、フォントは **Noto Serif CJK JP** に固定
  （`Noto Sans CJK JP` は使いません。未インストール環境で落ちるため）
- Python 3.11+
- フォント **Noto Serif CJK JP** がインストール済みであること

## セットアップ

```bash
cd kakomon-tool
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# （macOS/Linux なら: source .venv/bin/activate）

pip install -r requirements.txt

# APIキーは環境変数で渡す（コードに直書きしない）
# Windows PowerShell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
# （macOS/Linux なら: export ANTHROPIC_API_KEY=sk-ant-...）
```

`anthropic` が古いと adaptive thinking などで失敗する場合があります。その際は
`pip install -U anthropic` で更新してください。

## まずは無料で組版確認（モックモード）— 推奨の最初の一歩

API を一切使わず、あなたのフォント環境で LaTeX パイプラインが通るかを確認します。
サンプル問題（数式・図・要確認の赤枠を含む3問）から `.tex → PDF` を生成します。

```bash
python src/run.py --mock
```

成功すると `output/mondaishu.pdf` が生成されます。ここで確認すること:

- 日本語（明朝）と数式が正しく表示される
- 図が欠落せず貼られている（三角形のダミー図）
- 「要確認（自動判定）」の**赤枠**が表示される
- コンパイル時に **error / overfull が出ない**（コンソールに「Overfull 警告なし」と出る）

うまくいかない場合:

- `lualatex` が見つからない → TeX Live 2025 の PATH を確認
- フォント関連（`metric data not found` / `not loadable`）→ `Noto Serif CJK JP` が
  インストールされているか確認（テンプレートは Sans も Serif に固定済み）
- `headheight is too small` → テンプレートで 17pt に設定済み（本来出ないはず）

## 本番実行

年度ごとにPDFを `input/` へ置きます（ファイル名の拡張子前が年度になります）:

```
input/2021.pdf
input/2022.pdf
```

一気通貫:

```bash
python src/run.py                 # 全年度を split→extract→solve→build→compile
python src/run.py --year 2021     # 2021年度だけ（--year は複数指定可）
```

段階だけ実行（`--steps` に `split,extract,solve,build,compile` の部分集合）:

```bash
python src/run.py --steps split,extract      # 抽出まで
python src/run.py --steps solve              # 解答生成だけ
python src/run.py --steps build,compile      # 組版だけ
```

- **冪等性**: `work/` に中間JSON・画像をキャッシュします。再実行時は処理済みの
  ページ・問題をスキップして続きから再開するので、API課金の無駄が出ません。
  最初からやり直したいときは対象年度の `work/extract/{年度}/` や
  `work/solve/{年度}/` を削除してください。
- **レート制限・APIエラー**: 指数バックオフで自動リトライします。
- **進捗と概算コスト**: 標準出力に逐次表示します（`概算=$...` は目安）。

## 図の扱い（v1）

`has_figure=true` の問題は、抽出時に図の相対座標(bbox)も取得し、元ページ画像の
該当領域＋マージンを切り出して `\includegraphics` で貼ります。bbox が取れない/
無効なときは**ページ全体にフォールバック**します（図の欠落・崩壊を防ぐことを優先。
自動ベクター化はしません）。

## 設定（config.py）

| 項目 | 説明 |
|------|------|
| `EXTRACT_MODEL` / `SOLVE_MODEL` | 抽出用 / 解答用モデル（環境変数 `KAKOMON_EXTRACT_MODEL` / `KAKOMON_SOLVE_MODEL` でも上書き可） |
| `SUBJECT` | 教科（例: `"数学"`）。解答精度向上のためプロンプトに織り込む |
| `SELF_CHECK` | 2回解いて突き合わせるか（True/False） |
| `DPI` | ページ画像化の解像度 |
| `FIGURE_MARGIN` | 図切り出しのマージン（ページ比） |
| `MAX_RETRIES` / `BASE_DELAY` / `MAX_DELAY` | リトライ設定 |
| 各種パス | `input` / `work` / `output` / `templates` |

既定モデル:

- 抽出: `claude-haiku-4-5-20251001`（安価・Vision対応）
- 解答: `claude-sonnet-5`（推論精度とコストのバランス）。より高精度が必要なら
  `KAKOMON_SOLVE_MODEL=claude-opus-4-8` などに切り替え可能。

## ディレクトリ構成

```
kakomon-tool/
├─ input/                 年度ごとにPDFを置く（例: input/2021.pdf）
├─ work/                  中間JSON・切り出し画像（自動生成）
│   ├─ images/            ページ画像
│   ├─ extract/           抽出JSON（ページ単位キャッシュ + 年度集約）
│   └─ solve/             解答JSON（問題単位キャッシュ + 年度集約）
├─ output/                .tex / 完成PDF / figures/
├─ src/
│   ├─ split_pdf.py       PDF → ページ画像
│   ├─ extract.py         Claude Vision で問題抽出 → JSON
│   ├─ solve.py           解答・解説生成 + 自己検証
│   ├─ build_tex.py       JSON → LaTeX（Jinja2）
│   ├─ compile.py         lualatex ×2
│   ├─ run.py             一気通貫CLI
│   ├─ llm.py             Claude API 呼び出し共通処理（リトライ・コスト集計）
│   └─ mock_data.py       モック用サンプル問題
├─ templates/
│   └─ mondaishu.tex.j2   LaTeX テンプレート（jlreq + luatexja-fontspec）
├─ config.py
├─ requirements.txt
└─ README.md
```

## 注意

- 解答・解説は生成物です。`needs_review`（赤枠）の問題は特に、必ずご自身で確認してください。
- 問題文はモデルに忠実な引用をさせていますが、読み取り誤りの可能性はあります。
- 本ツールは個人の学習用途を想定しています。

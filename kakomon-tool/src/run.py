"""過去問PDF → 問題集PDF を一気通貫で実行するCLI。

例:
    python src/run.py                 # input/ 全年度を split→extract→solve→build→compile
    python src/run.py --year 2021     # 2021年度だけ
    python src/run.py --mock          # API不使用でLaTeXパイプラインだけ検証
    python src/run.py --steps build,compile   # 段階だけ実行

冪等性: work/ に中間JSON・画像をキャッシュし、再実行時は処理済みを
スキップして続きから再開する（API課金の無駄を防ぐ）。
"""

import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402
import split_pdf  # noqa: E402
import extract  # noqa: E402
import solve  # noqa: E402
import build_tex  # noqa: E402
import compile as compile_mod  # noqa: E402
import mock_data  # noqa: E402
from llm import COST  # noqa: E402

ALL_STEPS = ["split", "extract", "solve", "build", "compile"]


def _safe(name):
    return re.sub(r"[^0-9A-Za-z]+", "_", str(name)).strip("_") or "x"


def _numkey(number):
    m = re.search(r"\d+", str(number or ""))
    return (int(m.group()) if m else 9999, str(number or ""))


def _yearkey(year):
    m = re.search(r"\d+", str(year or ""))
    return (int(m.group()) if m else 9999, str(year or ""))


def _write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def _read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def discover_years(filter_years):
    pdfs = sorted(config.INPUT_DIR.glob("*.pdf"))
    years = []
    for pdf in pdfs:
        y = pdf.stem
        if filter_years and y not in filter_years:
            continue
        years.append((y, pdf))
    return years


# --------------------------------------------------------------------------
# 各ステップ
# --------------------------------------------------------------------------
def step_split(years):
    for year, pdf in years:
        print(f"[split] {year} ({pdf.name})")
        split_pdf.split_pdf(pdf, year)


def step_extract(years):
    for year, _pdf in years:
        print(f"[extract] {year}")
        imgs = sorted(config.IMAGES_DIR.glob(f"{year}_p*.png"))
        if not imgs:
            print(f"  画像がありません（先に split を実行してください）: {year}")
            continue
        problems = []
        for img in imgs:
            m = re.search(r"_p(\d+)\.png$", img.name)
            page = int(m.group(1))
            cache = config.EXTRACT_DIR / str(year) / f"p{page:02d}.json"
            if cache.exists():
                page_probs = _read_json(cache)
            else:
                print(f"  抽出中: {year} p.{page}")
                page_probs = extract.extract_page(year, page, str(img))
                _write_json(cache, page_probs)
                print("   ", COST.summary())
            problems.extend(page_probs)
        _write_json(config.EXTRACT_DIR / f"{year}.json", problems)
        print(f"  抽出完了: {year} … {len(problems)}問")


def step_solve(years):
    for year, _pdf in years:
        print(f"[solve] {year}")
        agg = config.EXTRACT_DIR / f"{year}.json"
        if not agg.exists():
            print(f"  抽出JSONがありません（先に extract を実行してください）: {year}")
            continue
        problems = _read_json(agg)
        solved = []
        for p in problems:
            num = p["number"]
            cache = config.SOLVE_DIR / str(year) / f"{_safe(num)}.json"
            if cache.exists():
                s = _read_json(cache)
            else:
                print(f"  解答中: {year} 問{num}")
                s = solve.solve_problem(p)
                _write_json(cache, s)
                flag = " ⚠要確認" if s.get("needs_review") else ""
                print("   ", COST.summary(), flag)
            solved.append(s)
        _write_json(config.SOLVE_DIR / f"{year}.json", solved)
        n_rev = sum(1 for s in solved if s.get("needs_review"))
        print(f"  解答完了: {year} … {len(solved)}問 / 要確認 {n_rev}問")


def _collect_solved(filter_years):
    all_solved = []
    for f in sorted(config.SOLVE_DIR.glob("*.json")):
        if not re.fullmatch(r".+\.json", f.name):
            continue
        # 年度集約ファイル（例: 2021.json）のみを対象にする
        year_stem = f.stem
        if filter_years and year_stem not in filter_years:
            continue
        try:
            all_solved.extend(_read_json(f))
        except Exception:
            continue
    all_solved.sort(key=lambda p: (_yearkey(p.get("year")), _numkey(p.get("number"))))
    return all_solved


def step_build(filter_years):
    print("[build]")
    problems = _collect_solved(filter_years)
    if not problems:
        print("  解答JSONがありません（先に solve を実行してください）。")
        return None
    return build_tex.build(problems, mock=False)


def step_compile():
    print("[compile]")
    tex = config.OUTPUT_DIR / "mondaishu.tex"
    if not tex.exists():
        print("  output/mondaishu.tex がありません（先に build を実行してください）。")
        return None
    return compile_mod.compile_tex(tex)


# --------------------------------------------------------------------------
# モック
# --------------------------------------------------------------------------
def run_mock():
    print("=== モックモード（API不使用）===")
    problems = mock_data.mock_problems()
    tex = build_tex.build(problems, mock=True)
    compile_mod.compile_tex(tex)
    print("モック完了。output/mondaishu.pdf を確認してください。")


# --------------------------------------------------------------------------
# メイン
# --------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="過去問PDF → 問題集PDF 生成ツール")
    parser.add_argument("--year", action="append", default=None,
                        help="対象年度（例: --year 2021）。複数指定可。省略時は全年度。")
    parser.add_argument("--steps", default=None,
                        help=f"実行する段階をカンマ区切りで指定（{','.join(ALL_STEPS)}）。"
                             f"省略時は全段階。")
    parser.add_argument("--mock", action="store_true",
                        help="サンプルJSONから .tex→PDF を生成（API課金なし）。")
    args = parser.parse_args()

    if args.mock:
        run_mock()
        return

    steps = ALL_STEPS if not args.steps else [s.strip() for s in args.steps.split(",") if s.strip()]
    invalid = [s for s in steps if s not in ALL_STEPS]
    if invalid:
        parser.error(f"不明な段階: {invalid}。使用可能: {ALL_STEPS}")

    filter_years = args.year
    years = discover_years(filter_years)

    if not years and any(s in steps for s in ("split", "extract", "solve")):
        print("input/ に対象PDFがありません。input/2021.pdf のように置いてください。")
        if filter_years:
            print(f"（--year {filter_years} で絞り込み中）")
        return

    if "split" in steps:
        step_split(years)
    if "extract" in steps:
        step_extract(years)
    if "solve" in steps:
        step_solve(years)
    if "build" in steps:
        step_build(filter_years)
    if "compile" in steps:
        step_compile()

    print("\n=== 完了 ===")
    print(COST.summary())
    if "compile" in steps:
        print(f"出力: {config.OUTPUT_DIR / 'mondaishu.pdf'}")


if __name__ == "__main__":
    main()

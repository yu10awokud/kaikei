"""JSON を統合し、年度→問番順に並べてテンプレートへ流し込み .tex を生成する。

- 各問に出典（元PDF名・ページ）を小さく表示。
- needs_review=true の問題は赤枠（reviewbox）で目立たせる。
- has_figure=true の問題は、元ページ画像の該当領域を切り出して貼る
  （bboxが無効なときはページ全体にフォールバック。図の欠落を防ぐ）。
"""

import os
import re
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402
import split_pdf  # noqa: E402

import fitz  # noqa: E402
from jinja2 import Environment, FileSystemLoader  # noqa: E402


def _env():
    return Environment(
        block_start_string=r"\BLOCK{", block_end_string="}",
        variable_start_string=r"\VAR{", variable_end_string="}",
        comment_start_string=r"\#{", comment_end_string="}",
        line_statement_prefix="%%",
        line_comment_prefix="%#",
        trim_blocks=True, lstrip_blocks=True, autoescape=False,
        loader=FileSystemLoader(str(config.TEMPLATE_DIR)),
    )


def clean_latex(s):
    """モデル由来のコードフェンス等を取り除く（中身はLaTeXとしてそのまま使う）。"""
    if not s:
        return ""
    s = str(s).strip()
    s = re.sub(r"^```[a-zA-Z0-9]*\s*", "", s)
    s = re.sub(r"\s*```$", "", s.strip())
    return s.strip()


def _safe(name):
    return re.sub(r"[^0-9A-Za-z]+", "_", str(name)).strip("_") or "x"


def _crop_figure(year, page, number, bbox, out_dir):
    """元ページ画像から図を切り出す。失敗時はページ全体をフォールバック。

    戻り値: 保存したファイル名（out_dir 直下）または None。
    """
    src = split_pdf.image_path(year, int(page))
    dst_name = f"fig_{_safe(year)}_{_safe(number)}.png"
    dst = out_dir / dst_name
    if not src.exists():
        return None
    # 1) bbox で切り出し
    try:
        x0, y0 = float(bbox.get("x0", 0)), float(bbox.get("y0", 0))
        x1, y1 = float(bbox.get("x1", 0)), float(bbox.get("y1", 0))
        m = config.FIGURE_MARGIN
        x0, y0 = max(0.0, x0 - m), max(0.0, y0 - m)
        x1, y1 = min(1.0, x1 + m), min(1.0, y1 + m)
        if (x1 - x0) < 0.05 or (y1 - y0) < 0.05:
            raise ValueError("bbox が小さすぎる/無効")
        doc = fitz.open(str(src))
        try:
            pg = doc[0]
            w, h = pg.rect.width, pg.rect.height
            clip = fitz.Rect(x0 * w, y0 * h, x1 * w, y1 * h)
            pix = pg.get_pixmap(clip=clip)
            pix.save(str(dst))
        finally:
            doc.close()
        return dst_name
    except Exception as e:
        print(f"    図の切り出しに失敗（ページ全体にフォールバック）: "
              f"{year} 問{number}: {e}", file=sys.stderr)
    # 2) フォールバック: ページ全体
    try:
        shutil.copyfile(str(src), str(dst))
        return dst_name
    except Exception:
        return None


def _prepare(problem, out_fig_dir):
    q = dict(problem)
    q["year"] = q.get("year", "")
    q["number"] = q.get("number", "")
    q["statement_latex"] = clean_latex(q.get("statement_latex", ""))
    q["answer_latex"] = clean_latex(q.get("answer_latex", ""))
    q["explanation_latex"] = clean_latex(q.get("explanation_latex", ""))
    q.setdefault("source_name", f"{q.get('year')}.pdf")
    q.setdefault("source_page", "-")
    q["needs_review"] = bool(q.get("needs_review", False))
    q.setdefault("review_reason", "")

    if q.get("figure_file"):
        # モックなど、既に図ファイルが用意されている場合はそのまま使う
        pass
    elif q.get("has_figure"):
        fname = _crop_figure(q["year"], q.get("source_page"), q["number"],
                             q.get("figure_bbox") or {}, out_fig_dir)
        q["figure_file"] = f"figures/{fname}" if fname else None
    else:
        q["figure_file"] = None
    return q


def build(problems, mock=False):
    """問題リストから .tex を生成して出力パスを返す。"""
    config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_fig = config.OUTPUT_DIR / "figures"
    out_fig.mkdir(parents=True, exist_ok=True)

    prepared = [_prepare(p, out_fig) for p in problems]

    template = _env().get_template("mondaishu.tex.j2")
    tex = template.render(title=config.DOC_TITLE, subject=config.SUBJECT,
                          problems=prepared)
    out = config.OUTPUT_DIR / "mondaishu.tex"
    out.write_text(tex, encoding="utf-8")

    n_review = sum(1 for p in prepared if p["needs_review"])
    print(f"  .tex 生成: {out}（{len(prepared)}問 / 要確認 {n_review}問）")
    return out

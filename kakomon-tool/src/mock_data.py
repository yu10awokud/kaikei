"""モックモード用のサンプル問題（API課金なしで LaTeX パイプラインを検証する）。

数式あり・図あり・needs_review あり を含む2〜3問を返す。
図はダミー画像を output/figures/ に生成して使う。
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402

import fitz  # noqa: E402


def _make_dummy_figure(path):
    """簡単な三角形の図（三平方の定理用）を描いて保存する。"""
    doc = fitz.open()
    page = doc.new_page(width=320, height=220)
    page.draw_rect(fitz.Rect(8, 8, 312, 212), color=(0, 0, 0), width=0.8)
    a = fitz.Point(70, 180)   # A（直角）
    b = fitz.Point(250, 180)  # B
    c = fitz.Point(70, 60)    # C
    page.draw_line(a, b, color=(0, 0, 0), width=1.2)
    page.draw_line(b, c, color=(0, 0, 0), width=1.2)
    page.draw_line(c, a, color=(0, 0, 0), width=1.2)
    # 直角マーク
    page.draw_rect(fitz.Rect(70, 165, 85, 180), color=(0, 0, 0), width=0.8)
    page.insert_text(fitz.Point(58, 195), "A", fontsize=12)
    page.insert_text(fitz.Point(255, 195), "B", fontsize=12)
    page.insert_text(fitz.Point(58, 56), "C", fontsize=12)
    pix = page.get_pixmap(dpi=150)
    pix.save(str(path))
    doc.close()


def mock_problems():
    fig_dir = config.OUTPUT_DIR / "figures"
    fig_dir.mkdir(parents=True, exist_ok=True)
    fig_name = "fig_mock_2.png"
    _make_dummy_figure(fig_dir / fig_name)

    return [
        {
            "year": "2021", "number": "1",
            "source_name": "2021.pdf", "source_page": 3,
            "has_figure": False, "figure_file": None,
            "statement_latex": r"次の方程式を解け。\[ x^2 - 5x + 6 = 0 \]",
            "final_answer": "x=2, 3",
            "answer_latex": r"\[ x = 2,\quad x = 3 \]",
            "explanation_latex": (
                r"左辺を因数分解すると \((x-2)(x-3)=0\)。"
                r"よって \(x-2=0\) または \(x-3=0\) となり、\(x=2\) または \(x=3\)。"),
            "needs_review": False, "review_reason": "",
        },
        {
            "year": "2021", "number": "2",
            "source_name": "2021.pdf", "source_page": 4,
            "has_figure": True, "figure_file": "figures/" + fig_name,
            "statement_latex": (
                r"下図の直角三角形 \(\triangle ABC\) において、"
                r"\(\angle A = 90^\circ,\ AB = 7,\ AC = 24\) のとき、"
                r"斜辺 \(BC\) の長さを求めよ。"),
            "final_answer": "25",
            "answer_latex": r"\[ BC = 25 \]",
            "explanation_latex": (
                r"三平方の定理より \(BC^2 = AB^2 + AC^2 = 7^2 + 24^2 "
                r"= 49 + 576 = 625\)。よって \(BC = \sqrt{625} = 25\)。"),
            "needs_review": False, "review_reason": "",
        },
        {
            "year": "2022", "number": "1",
            "source_name": "2022.pdf", "source_page": 2,
            "has_figure": False, "figure_file": None,
            "statement_latex": (
                r"数列 \(\{a_n\}\) が \(a_1 = 1,\ a_{n+1} = 2a_n + 1\ (n \ge 1)\) "
                r"を満たすとき、一般項 \(a_n\) を求めよ。"),
            "final_answer": "a_n = 2^n - 1",
            "answer_latex": r"\[ a_n = 2^{n} - 1 \]",
            "explanation_latex": (
                r"漸化式を \(a_{n+1} + 1 = 2(a_n + 1)\) と変形すると、"
                r"数列 \(\{a_n + 1\}\) は初項 \(a_1 + 1 = 2\)、公比 \(2\) の等比数列。"
                r"よって \(a_n + 1 = 2 \cdot 2^{n-1} = 2^{n}\) となり、\(a_n = 2^{n} - 1\)。"),
            # 自己検証で不一致が出たと仮定した見本（赤枠の確認用）
            "needs_review": True,
            "review_reason": "2回の解答が不一致（サンプル表示）",
        },
    ]

"""Claude Vision（抽出モデル）でページ画像から問題文だけを忠実にJSON化する。

1問 = 1レコード。フィールド:
    year, number, statement_latex, has_figure, source_page, figure_bbox
問題文は改変せず忠実に。数式は LaTeX 記法で。
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402
import llm  # noqa: E402

_SYSTEM = f"""あなたは試験の過去問を正確に読み取る専門家です。教科は「{config.SUBJECT}」です。
画像に写っている「問題文だけ」を忠実に抽出し、指定のJSON形式で返してください。

厳守事項:
- 問題文は改変・要約・補完をせず、原文どおりに書き写す。
- 数式・記号はすべて LaTeX 記法で表す（例: \\( x^2+1 \\), \\[ \\int_0^1 f(x)dx \\]）。
- 1問 = 1レコード。小問（(1)(2)など）が並ぶ大問は、その大問を1レコードにまとめ、
  小問は問題文の中に含める。
- number は原文の問題番号表記（例: "1", "第2問", "問3"）。
- 図・グラフ・表・図形を含む問題は has_figure=true とし、その図の位置を
  figure_bbox に「画像に対する相対座標」で示す（左上=(0,0)、右下=(1,1)、
  x0<y1 かつ x0<x1）。図が無ければ has_figure=false, figure_bbox は全て0。
- 解答・解説・ヒントは一切書かない（このフェーズでは問題文のみ）。
- 出力はJSONのみ。前後に説明文やコードフェンス(```)を付けない。

JSON形式:
{{"problems": [
  {{"number": "1",
    "statement_latex": "……",
    "has_figure": false,
    "figure_bbox": {{"x0": 0, "y0": 0, "x1": 0, "y1": 0}}}}
]}}
このページに問題が無ければ {{"problems": []}} を返す。"""


def _normalize(p, year, page, idx):
    p.setdefault("number", str(idx + 1))
    p["number"] = str(p["number"]).strip()
    p.setdefault("statement_latex", "")
    p.setdefault("has_figure", False)
    bbox = p.get("figure_bbox") or {}
    p["figure_bbox"] = {
        "x0": float(bbox.get("x0", 0) or 0),
        "y0": float(bbox.get("y0", 0) or 0),
        "x1": float(bbox.get("x1", 0) or 0),
        "y1": float(bbox.get("y1", 0) or 0),
    }
    p["year"] = year
    p["source_page"] = page
    return p


def extract_page(year, page, image_path):
    """1ページ分を抽出して問題リストを返す。"""
    content = [
        llm.image_block(image_path),
        {"type": "text",
         "text": f"これは {year}年 の過去問 p.{page} です。問題を抽出してJSONで返してください。"},
    ]
    data = llm.call_json(config.EXTRACT_MODEL, _SYSTEM, content,
                         config.EXTRACT_MAX_TOKENS, thinking=False)
    problems = data.get("problems", []) or []
    return [_normalize(p, year, page, i) for i, p in enumerate(problems)]

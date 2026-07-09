"""解答・解説を生成し、品質担保のため自己検証を行う。

- 途中式・根拠を省略せず answer_latex / explanation_latex を作らせる。
- SELF_CHECK が有効なら同じ問題を独立に2回解かせ、最終解答が食い違えば
  needs_review=true。
- 自信が低い場合も needs_review=true。
"""

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402
import llm  # noqa: E402

_SYSTEM = f"""あなたは「{config.SUBJECT}」の専門家です。与えられた問題を厳密に解答してください。

要件:
- 途中式・根拠を省略しない。
- answer_latex: 最終的な解答（LaTeX記法。必要なら複数行・数式環境を使う）。
- explanation_latex: 詳しい解説（考え方・途中式・根拠。LaTeX記法）。
- final_answer: 照合用の最終結論を簡潔に（例: "x=2,3" / "10" / "a_n=2^n-1"）。
- confidence: 解答への自信を "high" / "medium" / "low" のいずれかで。
- 数式・記号はすべて LaTeX 記法で表す。
- 出力はJSONのみ。前後に説明文やコードフェンス(```)を付けない。

JSON形式:
{{"final_answer": "……",
  "answer_latex": "……",
  "explanation_latex": "……",
  "confidence": "high"}}"""


def _norm_answer(s):
    """最終解答の突き合わせ用に正規化（空白・$・\\( \\) を除去）。"""
    if s is None:
        return ""
    s = str(s)
    s = s.replace("$", "").replace("\\(", "").replace("\\)", "")
    s = s.replace("\\[", "").replace("\\]", "")
    s = re.sub(r"\s+", "", s)
    return s.lower()


def _solve_once(problem):
    content = [{
        "type": "text",
        "text": (f"問題（{problem['year']}年 問{problem['number']}）:\n"
                 f"{problem['statement_latex']}"),
    }]
    data = llm.call_json(config.SOLVE_MODEL, _SYSTEM, content,
                         config.SOLVE_MAX_TOKENS, thinking=True)
    return {
        "final_answer": str(data.get("final_answer", "")).strip(),
        "answer_latex": data.get("answer_latex", ""),
        "explanation_latex": data.get("explanation_latex", ""),
        "confidence": str(data.get("confidence", "medium")).lower().strip(),
    }


def solve_problem(problem):
    """1問を解き、needs_review 判定込みの結果 dict を返す。"""
    runs = []
    n = 2 if config.SELF_CHECK else 1
    for _ in range(n):
        runs.append(_solve_once(problem))

    primary = runs[0]
    needs_review = False
    reasons = []

    if primary["confidence"] == "low":
        needs_review = True
        reasons.append("自信が低い(confidence=low)")

    if config.SELF_CHECK and n >= 2:
        if _norm_answer(runs[0]["final_answer"]) != _norm_answer(runs[1]["final_answer"]):
            needs_review = True
            reasons.append(f"2回の解答が不一致（1回目: {runs[0]['final_answer']} / "
                           f"2回目: {runs[1]['final_answer']}）")

    result = dict(problem)  # year/number/statement_latex/has_figure/figure_bbox/source_page を引き継ぐ
    result.update({
        "final_answer": primary["final_answer"],
        "answer_latex": primary["answer_latex"],
        "explanation_latex": primary["explanation_latex"],
        "confidence": primary["confidence"],
        "needs_review": needs_review,
        "review_reason": " / ".join(reasons),
    })
    if config.SELF_CHECK and n >= 2:
        result["second_final_answer"] = runs[1]["final_answer"]
    return result

"""output/ で lualatex を2回実行して最終PDFを作る。

ページ番号・fancyhdr を反映させるため2回コンパイルする。
overfull 警告があればログから拾って表示する。
"""

import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402


def compile_tex(tex_path):
    tex_path = Path(tex_path)
    workdir = tex_path.parent
    name = tex_path.name
    stem = tex_path.stem

    for i in (1, 2):
        print(f"  lualatex 実行 {i}/2 …")
        proc = subprocess.run(
            ["lualatex", "-interaction=nonstopmode", "-halt-on-error", name],
            cwd=str(workdir), capture_output=True, text=True,
        )
        if proc.returncode != 0:
            print("  lualatex がエラーで終了しました。末尾の出力:", file=sys.stderr)
            print(proc.stdout[-3000:], file=sys.stderr)
            if proc.stderr.strip():
                print(proc.stderr[-1000:], file=sys.stderr)
            raise RuntimeError(f"lualatex に失敗しました（{name}）。"
                               f"詳細は {workdir / (stem + '.log')} を確認してください。")

    pdf = workdir / (stem + ".pdf")
    log = workdir / (stem + ".log")
    if log.exists():
        txt = log.read_text(errors="ignore")
        overfull = [ln for ln in txt.splitlines() if "Overfull" in ln]
        if overfull:
            print(f"  ⚠ Overfull 警告 {len(overfull)} 件（先頭5件）:")
            for ln in overfull[:5]:
                print("     " + ln)
        else:
            print("  Overfull 警告なし")

    if pdf.exists():
        print(f"  完成PDF: {pdf}")
    return pdf


def _main():
    tex = config.OUTPUT_DIR / "mondaishu.tex"
    if not tex.exists():
        print("output/mondaishu.tex がありません。先に build を実行してください。")
        return
    compile_tex(tex)


if __name__ == "__main__":
    _main()

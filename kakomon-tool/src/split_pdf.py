"""PDF → ページ画像（300dpi程度）。ファイル名に年度とページ番号を含める。"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402

import fitz  # PyMuPDF  # noqa: E402


def image_path(year, page):
    return config.IMAGES_DIR / f"{year}_p{page:02d}.png"


def split_pdf(pdf_path, year):
    """1つのPDFをページ画像に変換する。既存画像はスキップ（冪等）。"""
    config.IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(str(pdf_path))
    paths = []
    try:
        for i in range(len(doc)):
            page_no = i + 1
            out = image_path(year, page_no)
            if out.exists():
                paths.append(out)
                continue
            pix = doc[i].get_pixmap(dpi=config.DPI)
            pix.save(str(out))
            paths.append(out)
            print(f"    画像化: {out.name}")
    finally:
        doc.close()
    return paths


def _main():
    # スタンドアロン実行: input/*.pdf をすべて画像化
    pdfs = sorted(config.INPUT_DIR.glob("*.pdf"))
    if not pdfs:
        print("input/ にPDFがありません。")
        return
    for pdf in pdfs:
        year = pdf.stem
        print(f"[{year}] {pdf.name}")
        split_pdf(pdf, year)


if __name__ == "__main__":
    _main()

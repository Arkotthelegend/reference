from __future__ import annotations

import hashlib
import shutil
from pathlib import Path

from .config import CACHE_DIR

MIN_TEXT_CHARS = 80
OCR_DPI = 200
_TESSERACT_WARNED = False


def page_count(path: Path) -> int:
    import fitz

    with fitz.open(path) as doc:
        return doc.page_count


def tesseract_path() -> str | None:
    found = shutil.which("tesseract")
    if found:
        return found
    for candidate in (
        "/opt/homebrew/bin/tesseract",
        "/usr/local/bin/tesseract",
    ):
        if Path(candidate).exists():
            return candidate
    return None


def ocr_ready() -> bool:
    if not tesseract_path():
        return False
    try:
        import pytesseract  # noqa: F401
        from PIL import Image  # noqa: F401
    except ImportError:
        return False
    return True


def scan_help() -> str:
    return """
This PDF is a scan (photos of pages), so there is no text to copy.
Install free OCR on your Mac, then run the same command again.

  1. Install Homebrew if you do not have it (one time):
     https://brew.sh

  2. In Terminal:
     brew install tesseract
     source .venv/bin/activate
     pip install pytesseract pillow

  3. Then:
     python3 convert.py --only G10_phy

OCR is free and local. It does not use your ChatGPT $10.
The first run is slow (it reads every page like a camera). Later runs reuse cache/.
""".strip()


def _page_text(page) -> str:
    text = (page.get_text("text") or "").strip()
    if len(text) >= MIN_TEXT_CHARS:
        return text
    blocks = page.get_text("blocks") or []
    parts = [b[4] for b in blocks if len(b) >= 5 and isinstance(b[4], str)]
    joined = "\n".join(p.strip() for p in parts if p.strip())
    return joined if len(joined) >= MIN_TEXT_CHARS else (joined or text)


def extract_pages(path: Path, start: int, end: int) -> str:
    """Extract text for inclusive 1-based PDF-viewer page numbers."""
    import fitz

    chunks: list[str] = []
    ocr_used = False
    with fitz.open(path) as doc:
        last = min(end, doc.page_count)
        first = max(1, start)
        total = last - first + 1
        for n, i in enumerate(range(first, last + 1), start=1):
            page = doc.load_page(i - 1)
            text = _page_text(page)
            if len(text) < MIN_TEXT_CHARS:
                ocr = _ocr_page(path, page, i)
                if ocr:
                    text = ocr
                    ocr_used = True
                    print(f"    OCR page {i} ({n}/{total})", flush=True)
            if text:
                chunks.append(f"[PDF page {i}]\n{text}")
    result = "\n\n".join(chunks).strip()
    if not result:
        _warn_if_no_ocr()
    elif ocr_used:
        print("    (OCR text will be reused from cache/ next time)")
    return result


def _warn_if_no_ocr() -> None:
    global _TESSERACT_WARNED
    if _TESSERACT_WARNED:
        return
    _TESSERACT_WARNED = True
    print(scan_help())


def _ocr_cache_file(pdf: Path, page_no: int) -> Path:
    digest = hashlib.sha256(f"{pdf.resolve()}:{pdf.stat().st_mtime_ns}".encode()).hexdigest()[:16]
    folder = CACHE_DIR / "ocr" / digest
    folder.mkdir(parents=True, exist_ok=True)
    return folder / f"page_{page_no:04d}.txt"


def _ocr_page(pdf: Path, page, page_no: int) -> str:
    cache = _ocr_cache_file(pdf, page_no)
    if cache.exists():
        return cache.read_text(encoding="utf-8").strip()
    cmd = tesseract_path()
    if not cmd:
        return ""
    try:
        import pytesseract
        from PIL import Image
        import io
    except ImportError:
        return ""
    pytesseract.pytesseract.tesseract_cmd = cmd
    try:
        pix = page.get_pixmap(dpi=OCR_DPI)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        text = (pytesseract.image_to_string(img, lang="eng") or "").strip()
    except Exception:
        text = ""
    if text:
        cache.write_text(text + "\n", encoding="utf-8")
    return text

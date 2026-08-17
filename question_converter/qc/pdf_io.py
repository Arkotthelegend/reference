from __future__ import annotations

from pathlib import Path

MIN_TEXT_CHARS = 40


def page_count(path: Path) -> int:
    import fitz

    with fitz.open(path) as doc:
        return doc.page_count


def _page_text(page) -> str:
    text = (page.get_text("text") or "").strip()
    if len(text) >= MIN_TEXT_CHARS:
        return text
    # Try blocks if the simple extract was nearly empty.
    blocks = page.get_text("blocks") or []
    parts = [b[4] for b in blocks if len(b) >= 5 and isinstance(b[4], str)]
    return "\n".join(p.strip() for p in parts if p.strip())


def extract_pages(path: Path, start: int, end: int) -> str:
    """Extract text for inclusive 1-based PDF-viewer page numbers."""
    import fitz

    chunks: list[str] = []
    with fitz.open(path) as doc:
        last = min(end, doc.page_count)
        first = max(1, start)
        for i in range(first, last + 1):
            page = doc.load_page(i - 1)
            text = _page_text(page)
            if not text:
                text = _ocr_page(page)
            if text:
                chunks.append(f"[PDF page {i}]\n{text}")
    return "\n\n".join(chunks).strip()


def _ocr_page(page) -> str:
    """Optional local OCR. Never sends page images to a paid vision API."""
    try:
        import pytesseract
        from PIL import Image
        import io
    except ImportError:
        return ""
    try:
        pix = page.get_pixmap(dpi=150)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        return (pytesseract.image_to_string(img) or "").strip()
    except Exception:
        return ""


def preview_pages(path: Path, n: int = 2) -> str:
    count = page_count(path)
    end = min(n, count)
    text = extract_pages(path, 1, end)
    if len(text) > 800:
        text = text[:800] + "\n..."
    return f"{count} pages. First-page preview:\n{text or '(no selectable text — scanned PDF; install pytesseract for local OCR)'}"

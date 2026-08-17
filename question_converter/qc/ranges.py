from __future__ import annotations

import re
from typing import Iterator

RANGE_RE = re.compile(
    r"(?:p(?:age)?\.?\s*)?(\d+)\s*(?:-|–|to|:)\s*(?:p(?:age)?\.?\s*)?(\d+)",
    re.I,
)
CHAPTER_LINE_RE = re.compile(
    r"^\s*(?:ch(?:apter)?|unit)?\s*(\d+)\s*[:.\-]\s*(.+)$",
    re.I,
)
SECTION_PAIR_RE = re.compile(
    r"(\d+\.\d+)\s*[:\-]\s*(\d+\s*(?:-|–|to)\s*\d+)",
    re.I,
)


def parse_page_range(text: str, page_count: int | None = None) -> tuple[int, int]:
    text = (text or "").strip()
    m = RANGE_RE.search(text)
    if not m:
        raise ValueError(
            f"Could not read page range '{text}'. Use PDF viewer pages like 12-35."
        )
    start, end = int(m.group(1)), int(m.group(2))
    if start > end:
        start, end = end, start
    if start < 1:
        raise ValueError("Page numbers start at 1 (first page of the PDF).")
    if page_count and end > page_count:
        raise ValueError(f"Page {end} is past the end of this PDF ({page_count} pages).")
    return start, end


def parse_chapter_block(text: str, page_count: int | None = None) -> dict[int, tuple[int, int]]:
    """Parse lines such as '1: 5-28' or 'Chapter 2: 29-50'."""
    out: dict[int, tuple[int, int]] = {}
    for raw in (text or "").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = CHAPTER_LINE_RE.match(line)
        if m:
            num = int(m.group(1))
            out[num] = parse_page_range(m.group(2), page_count)
            continue
        # Fallback: '1 5-28'
        m2 = re.match(r"^(\d+)\s+(.+)$", line)
        if m2:
            out[int(m2.group(1))] = parse_page_range(m2.group(2), page_count)
            continue
        raise ValueError(f"Could not parse chapter line: {line}")
    return out


def parse_section_ranges(text: str, page_count: int | None = None) -> dict[str, tuple[int, int]]:
    """Parse '1.1:12-18, 1.2:19-28'."""
    out: dict[str, tuple[int, int]] = {}
    for m in SECTION_PAIR_RE.finditer(text or ""):
        out[m.group(1)] = parse_page_range(m.group(2), page_count)
    if text.strip() and not out:
        raise ValueError(
            "Could not parse sub-chapters. Example: 1.1:12-18, 1.2:19-28"
        )
    return out


def iter_pages(start: int, end: int) -> Iterator[int]:
    yield from range(start, end + 1)

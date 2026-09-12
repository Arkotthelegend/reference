from __future__ import annotations

import re
from pathlib import Path

CHAPTER_IN_TITLE = re.compile(
    r"(?i)\b(?:chapter|unit|ch\.?)\s*(\d+)\b",
)
PAGE_HEAD = re.compile(
    r"(?im)^\s*(?:chapter|unit|ch\.?)\s+(\d+)\b",
)


def detect_chapter_starts(path: Path) -> list[tuple[int, int]]:
    """Return [(chapter_or_unit_number, pdf_page), ...] using bookmarks then headings."""
    import fitz

    with fitz.open(path) as doc:
        from_toc = _from_toc(doc)
        if len(from_toc) >= 2:
            return from_toc
        from_text = _from_headings(doc)
        return from_text if from_text else from_toc


def starts_to_ranges(
    starts: list[tuple[int, int]], page_count: int
) -> dict[int, tuple[int, int]]:
    ordered = sorted(starts, key=lambda x: (x[1], x[0]))
    uniq: dict[int, int] = {}
    for num, page in ordered:
        uniq.setdefault(num, page)
    nums = sorted(uniq)
    out: dict[int, tuple[int, int]] = {}
    for i, num in enumerate(nums):
        start = uniq[num]
        if i + 1 < len(nums):
            end = uniq[nums[i + 1]] - 1
        else:
            end = page_count
        if end < start:
            end = start
        out[num] = (start, min(end, page_count))
    return out


def _from_toc(doc) -> list[tuple[int, int]]:
    found: list[tuple[int, int]] = []
    for _level, title, page in doc.get_toc() or []:
        m = CHAPTER_IN_TITLE.search(title or "")
        if not m:
            continue
        found.append((int(m.group(1)), max(1, int(page))))
    return _first_page_per_chapter(found)


def _from_headings(doc) -> list[tuple[int, int]]:
    found: list[tuple[int, int]] = []
    for i in range(doc.page_count):
        text = (doc.load_page(i).get_text("text") or "")[:1200]
        m = PAGE_HEAD.search(text)
        if m:
            found.append((int(m.group(1)), i + 1))
    return _first_page_per_chapter(found)


def _first_page_per_chapter(items: list[tuple[int, int]]) -> list[tuple[int, int]]:
    seen: dict[int, int] = {}
    for num, page in items:
        if num not in seen or page < seen[num]:
            seen[num] = page
    return [(n, seen[n]) for n in sorted(seen)]

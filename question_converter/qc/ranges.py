from __future__ import annotations

import re
from typing import Iterator

RANGE_RE = re.compile(
    r"(?:p(?:age)?\.?\s*)?(\d+)\s*(?:-|–|to)\s*(?:p(?:age)?\.?\s*)?(\d+)",
    re.I,
)
SINGLE_PAGE_RE = re.compile(r"^(?:p(?:age)?\.?\s*)?(\d+)$", re.I)
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
    if m:
        start, end = int(m.group(1)), int(m.group(2))
    else:
        one = SINGLE_PAGE_RE.match(text)
        if not one:
            raise ValueError(
                f"Could not read '{text}'. Type two pages like 12-35 "
                "(first page of the chapter, then last page)."
            )
        start = end = int(one.group(1))
    if start > end:
        start, end = end, start
    if start < 1:
        raise ValueError("Page numbers start at 1 (first page of the PDF).")
    if page_count and end > page_count:
        raise ValueError(f"Page {end} is past the end of this PDF ({page_count} pages).")
    return start, end


def parse_chapter_block(text: str, page_count: int | None = None) -> dict[int, tuple[int, int]]:
    """Parse '1: 5-28' or start-only lines like '1: 17' (end = next chapter - 1)."""
    starts: dict[int, int] = {}
    ranges: dict[int, tuple[int, int]] = {}
    for raw in (text or "").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = CHAPTER_LINE_RE.match(line) or re.match(r"^(\d+)\s+(.+)$", line)
        if not m:
            raise ValueError(f"Could not parse chapter line: {line}")
        num = int(m.group(1))
        rest = m.group(2).strip()
        if RANGE_RE.search(rest):
            ranges[num] = parse_page_range(rest, page_count)
        elif SINGLE_PAGE_RE.match(rest):
            starts[num] = int(SINGLE_PAGE_RE.match(rest).group(1))
        else:
            ranges[num] = parse_page_range(rest, page_count)

    if starts:
        filled = _fill_from_starts(starts, page_count)
        for num, rng in filled.items():
            ranges.setdefault(num, rng)
    return dict(sorted(ranges.items()))


def _fill_from_starts(
    starts: dict[int, int], page_count: int | None
) -> dict[int, tuple[int, int]]:
    nums = sorted(starts)
    out: dict[int, tuple[int, int]] = {}
    for i, num in enumerate(nums):
        start = starts[num]
        if i + 1 < len(nums):
            end = starts[nums[i + 1]] - 1
        elif page_count:
            end = page_count
        else:
            end = start
        if end < start:
            end = start
        out[num] = (start, end)
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

from __future__ import annotations

import json
from pathlib import Path

from .chapter_detect import detect_chapter_starts, starts_to_ranges
from .config import MAPS_DIR, SUBJECT_NAMES
from .detect import TextbookPdf
from .pdf_io import page_count
from .ranges import parse_chapter_block, parse_page_range, parse_section_ranges


def map_path(book: TextbookPdf) -> Path:
    MAPS_DIR.mkdir(parents=True, exist_ok=True)
    return MAPS_DIR / f"{book.key}.json"


def load_map(book: TextbookPdf) -> dict | None:
    path = map_path(book)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def save_map(book: TextbookPdf, data: dict) -> Path:
    path = map_path(book)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return path


def _ask(prompt: str, default: str | None = None) -> str:
    suffix = f" [{default}]" if default not in (None, "") else ""
    raw = input(f"{prompt}{suffix}: ").strip()
    if not raw and default is not None:
        return default
    return raw


def _ask_int(prompt: str, default: int | None = None) -> int:
    while True:
        raw = _ask(prompt, None if default is None else str(default))
        try:
            return int(raw)
        except ValueError:
            print("  Please enter a whole number.")


def _ask_yes(prompt: str, default: bool = True) -> bool:
    raw = _ask(prompt, "Y" if default else "n").lower()
    if not raw:
        return default
    return raw.startswith("y")


def setup_book(book: TextbookPdf, force: bool = False) -> dict:
    existing = load_map(book)
    if existing and not force:
        print(f"\nUsing saved chapter map: {map_path(book)}")
        return existing

    pages = page_count(book.path)
    book.page_count = pages
    unit_word = "units" if book.subject == "en" else "chapters"
    print("\n" + "=" * 60)
    print(f"{book.label}")
    print(f"PDF: {book.path}")
    print(f"Pages in this file (PDF viewer numbers): {pages}")
    print("Use the page numbers you see in Preview, not printed textbook numbers.")
    print("=" * 60)

    guessed = starts_to_ranges(detect_chapter_starts(book.path), pages)
    parsed: dict[int, tuple[int, int]] = {}
    if guessed:
        print(f"\nI found these {unit_word} in the PDF:")
        for num, (start, end) in guessed.items():
            print(f"  {num}: {start}-{end}")
        if _ask_yes("Use these pages?", True):
            parsed = guessed

    if not parsed:
        n = _ask_int(
            f"How many {unit_word} are in this textbook?",
            default=max(guessed) if guessed else None,
        )
        print(
            f"\nPaste each {unit_word[:-1]} on its own line.\n"
            "You can type the first page only:\n"
            "  1: 17\n"
            "  2: 45\n"
            "or a full range:\n"
            "  1: 17-44\n"
            "Blank line when finished."
        )
        block: list[str] = []
        print(f"Paste {unit_word} pages (blank line to finish):")
        while True:
            line = input()
            if not line.strip():
                break
            block.append(line)
        if block:
            try:
                parsed = parse_chapter_block("\n".join(block), pages)
            except ValueError as extra:
                print(f"  {extra}")
                print("  Example: 1: 17   or   1: 17-44")
                parsed = {}
        if not parsed:
            parsed = _ask_each_chapter(n, book.subject, pages)

    n = max(parsed) if parsed else 0
    chapters: list[dict] = []
    for num in range(1, n + 1):
        if num not in parsed:
            continue
        start, end = parsed[num]
        item = {"number": num, "pages": [start, end], "sections": []}
        if book.subject in {"phy", "chem", "bio"}:
            raw_sec = _ask(
                f"  Sub-chapters for {num}? (Enter = auto-detect from headings, "
                "or 1.1:12-18, 1.2:19-28)",
                "",
            )
            if raw_sec.strip():
                try:
                    for sid, rng in parse_section_ranges(raw_sec, pages).items():
                        item["sections"].append({"id": sid, "pages": list(rng)})
                except ValueError as extra:
                    print(f"  {extra}  (I'll auto-detect instead.)")
        chapters.append(item)

    data = {
        "key": book.key,
        "grade": book.grade,
        "subject": book.subject,
        "subject_name": SUBJECT_NAMES[book.subject],
        "pdf": str(book.path),
        "page_count": pages,
        "chapters": chapters,
    }
    path = save_map(book, data)
    print(f"Saved chapter map → {path}")
    return data


def _ask_each_chapter(n: int, subject: str, pages: int) -> dict[int, tuple[int, int]]:
    parsed: dict[int, tuple[int, int]] = {}
    for num in range(1, n + 1):
        label = "Unit" if subject == "en" else "Chapter"
        while True:
            raw = _ask(f"{label} {num} pages (e.g. 12-35 or just the first page 12)")
            try:
                parsed[num] = parse_page_range(raw, pages)
                break
            except ValueError as extra:
                print(f"  {extra}")
    starts_only = {k: v[0] for k, v in parsed.items() if v[0] == v[1]}
    if len(starts_only) == n and n > 1:
        from .ranges import _fill_from_starts

        return _fill_from_starts(starts_only, pages)
    return parsed

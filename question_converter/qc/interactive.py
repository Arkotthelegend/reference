from __future__ import annotations

import json
from pathlib import Path

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
    print("Use the page numbers you see in Preview / Chrome, not printed textbook numbers.")
    print("=" * 60)

    n = _ask_int(f"How many {unit_word} are in this textbook?")
    print(
        f"\nYou can paste every {unit_word[:-1]} on its own line, e.g.\n"
        "  1: 5-28\n"
        "  2: 29-51\n"
        "Or press Enter to be asked one by one."
    )
    block = []
    print(f"Paste {unit_word} page ranges (blank line to finish):")
    while True:
        line = input()
        if not line.strip():
            break
        block.append(line)
    chapters: list[dict] = []
    parsed: dict[int, tuple[int, int]] = {}
    if block:
        parsed = parse_chapter_block("\n".join(block), pages)

    for num in range(1, n + 1):
        if num in parsed:
            start, end = parsed[num]
        else:
            label = "Unit" if book.subject == "en" else "Chapter"
            raw = _ask(f"{label} {num} page range (e.g. 12-35)")
            start, end = parse_page_range(raw, pages)
        item = {"number": num, "pages": [start, end], "sections": []}
        if book.subject in {"phy", "chem", "bio"}:
            raw_sec = _ask(
                f"  Sub-chapters for {num}? (Enter = auto-detect from headings, "
                "or 1.1:12-18, 1.2:19-28)",
                "",
            )
            if raw_sec.strip():
                for sid, rng in parse_section_ranges(raw_sec, pages).items():
                    item["sections"].append({"id": sid, "pages": list(rng)})
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

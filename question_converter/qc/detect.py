from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from .config import PDFS_DIR, SUBJECT_ALIASES

GRADE_RE = re.compile(
    r"(?:grade\s*[-_]?|g\s*[-_]?)(10|11)(?:\b|_|-|$)|(?:^|[-_\s.])(10|11)(?:[-_\s.]|$)",
    re.I,
)
SUBJECT_RE = re.compile(
    r"\b(english|eng|en|mathematics|maths|math|physics|phy|chemistry|chem|biology|bio)\b",
    re.I,
)


@dataclass
class TextbookPdf:
    path: Path
    grade: int
    subject: str
    page_count: int | None = None

    @property
    def key(self) -> str:
        return f"G{self.grade}_{self.subject}"

    @property
    def label(self) -> str:
        names = {
            "en": "English",
            "math": "Mathematics",
            "phy": "Physics",
            "chem": "Chemistry",
            "bio": "Biology",
        }
        return f"Grade {self.grade} {names.get(self.subject, self.subject)}"


def _grade_from_parts(path: Path) -> int | None:
    for part in path.parts:
        p = part.lower()
        if p in {"g10", "grade10", "grade_10", "grade-10"}:
            return 10
        if p in {"g11", "grade11", "grade_11", "grade-11"}:
            return 11
    m = GRADE_RE.search(path.stem)
    if not m:
        return None
    return int(m.group(1) or m.group(2))


def _subject_from_name(path: Path) -> str | None:
    m = SUBJECT_RE.search(path.stem.replace("_", " ").replace("-", " "))
    if not m:
        # Bare names like phy.pdf
        token = path.stem.lower().strip()
        return SUBJECT_ALIASES.get(token)
    return SUBJECT_ALIASES.get(m.group(1).lower())


def parse_textbook_path(path: Path) -> TextbookPdf | None:
    grade = _grade_from_parts(path)
    subject = _subject_from_name(path)
    if grade not in (10, 11) or not subject:
        return None
    return TextbookPdf(path=path, grade=grade, subject=subject)


def discover_pdfs(pdfs_dir: Path | None = None) -> list[TextbookPdf]:
    root = pdfs_dir or PDFS_DIR
    found: dict[str, TextbookPdf] = {}
    if not root.exists():
        return []
    for path in sorted(root.rglob("*.pdf")):
        book = parse_textbook_path(path)
        if not book:
            continue
        found[book.key] = book
    return [found[k] for k in sorted(found)]


def expected_slots() -> list[tuple[int, str]]:
    subjects = ("en", "math", "phy", "chem", "bio")
    return [(grade, sub) for grade in (10, 11) for sub in subjects]

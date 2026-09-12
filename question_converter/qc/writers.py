from __future__ import annotations

import json
from pathlib import Path

from .config import (
    english_filename,
    math_filename,
    output_file,
    science_section_filename,
)


def dump_json(path: Path, data) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def write_quiz(grade: int, filename: str, data) -> Path:
    return dump_json(output_file(grade, filename), data)


def write_science(
    grade: int,
    subject: str,
    chapter: int,
    section: str | None,
    kind: str,
    items: list[dict],
) -> Path:
    return write_quiz(grade, science_section_filename(subject, chapter, section, kind), items)


def write_math(grade: int, chapter: int, marks: int, items: list[dict]) -> Path:
    return write_quiz(grade, math_filename(chapter, marks), items)


def write_english(grade: int, unit: int, kind: str, items: list[dict]) -> Path:
    return write_quiz(grade, english_filename(unit, kind), items)

from __future__ import annotations

import json
from pathlib import Path

from .config import (
    OUTPUT_DIR,
    QUIZZES_DIR,
    english_filename,
    grade_folder,
    grade_prefix,
    math_filename,
    science_section_filename,
)


def dump_json(path: Path, data) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def output_paths(grade: int, filename: str, install: bool) -> list[Path]:
    prefix = grade_prefix(grade)
    folder = grade_folder(grade)
    prefixed = prefix + filename
    paths = [OUTPUT_DIR / folder / prefixed]
    if install and folder:
        paths.append(QUIZZES_DIR / folder / prefixed)
    return paths


def write_quiz(grade: int, filename: str, data, install: bool = True) -> list[Path]:
    written = []
    for path in output_paths(grade, filename, install):
        written.append(dump_json(path, data))
    return written


def write_science(
    grade: int,
    subject: str,
    chapter: int,
    section: str | None,
    kind: str,
    items: list[dict],
    install: bool = True,
) -> list[Path]:
    name = science_section_filename(subject, chapter, section, kind)
    return write_quiz(grade, name, items, install)


def write_math(grade: int, chapter: int, marks: int, items: list[dict], install: bool = True) -> list[Path]:
    return write_quiz(grade, math_filename(chapter, marks), items, install)


def write_english(grade: int, unit: int, kind: str, items: list[dict], install: bool = True) -> list[Path]:
    return write_quiz(grade, english_filename(unit, kind), items, install)

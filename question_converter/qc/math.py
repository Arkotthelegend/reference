from __future__ import annotations

from pathlib import Path

from .ai import AIClient
from .balance import dedupe_questions, shuffle_mcq_answers
from .config import (
    MAX_CHARS_PER_CALL,
    MATH_1_MARK_COUNT,
    MATH_2_MARK_COUNT,
    MATH_3_MARK_COUNT,
    math_filename,
    output_file,
)
from .parse import chunk_text, parse_sectioned_questions
from .pdf_io import extract_pages, scan_help
from .prompts import render
from .validate import flatten_grouped, validate_math_show, validate_mcq
from .writers import write_math


def generate_math_book(client: AIClient, book, mapping: dict, skip_existing: bool) -> None:
    pdf = Path(mapping["pdf"])
    grade = mapping["grade"]
    jobs = [
        (1, MATH_1_MARK_COUNT, "math_1mark.txt", "mcq"),
        (2, MATH_2_MARK_COUNT, "math_show.txt", "show"),
        (3, MATH_3_MARK_COUNT, "math_show.txt", "show"),
    ]
    for ch in mapping["chapters"]:
        num = int(ch["number"])
        text = extract_pages(pdf, ch["pages"][0], ch["pages"][1])
        if not text:
            print(f"  ! Math chapter {num}: no text extracted")
            print(scan_help())
            continue
        for marks, bounds, prompt_name, kind in jobs:
            fname = math_filename(num, marks)
            dest = output_file(grade, fname)
            if skip_existing and dest.exists():
                print(f"  skip {dest.name}")
                continue
            target = (bounds[0] + bounds[1]) // 2
            items = _generate(client, prompt_name, kind, marks, text, target)
            write_math(grade, num, marks, items)
            print(f"  wrote {fname} ({len(items)} items)")


def _generate(client: AIClient, prompt_name: str, kind: str, marks: int, text: str, target: int) -> list[dict]:
    chunks = chunk_text(text, MAX_CHARS_PER_CALL)
    per = max(8, target // max(len(chunks), 1))
    collected: list[dict] = []
    for chunk in chunks:
        system = render(prompt_name, target=per, marks=marks)
        user = f"Chapter extract for {marks}-mark questions. Make about {per} items.\n\n{chunk}"
        raw = client.complete(system, user, json_mode=True)
        grouped = parse_sectioned_questions(raw)
        for item in flatten_grouped(grouped):
            if kind == "mcq":
                clean = validate_mcq(item, 4, include_e=False)
            else:
                clean = validate_math_show(item)
            if clean:
                collected.append(clean)
    collected = dedupe_questions(collected)
    if kind == "mcq":
        collected = shuffle_mcq_answers(collected)
    return collected[: bounds_cap(target)]


def bounds_cap(target: int) -> int:
    return target + 8

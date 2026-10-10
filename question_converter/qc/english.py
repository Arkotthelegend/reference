from __future__ import annotations

from pathlib import Path

from .ai import AIClient
from .balance import dedupe_questions, shuffle_mcq_answers
from .config import (
    EN_INITIAL_COUNT,
    EN_MCQ_COUNT,
    MAX_CHARS_PER_CALL,
    english_filename,
    output_file,
)
from .parse import chunk_text, parse_sectioned_questions
from .pdf_io import extract_pages, scan_help
from .prompts import render
from .validate import flatten_grouped, validate_english_initial, validate_mcq
from .writers import write_english


def generate_english_book(client: AIClient, book, mapping: dict, skip_existing: bool) -> None:
    pdf = Path(mapping["pdf"])
    grade = mapping["grade"]
    for ch in mapping["chapters"]:
        unit = int(ch["number"])
        text = extract_pages(pdf, ch["pages"][0], ch["pages"][1])
        if not text:
            print(f"  ! English unit {unit}: no text extracted")
            print(scan_help())
            continue
        _one(client, grade, unit, text, "initial_letter", "english_initial.txt", EN_INITIAL_COUNT, skip_existing)
        _one(client, grade, unit, text, "mcq", "english_mcq.txt", EN_MCQ_COUNT, skip_existing)


def _one(client, grade, unit, text, kind, prompt_name, target, skip_existing) -> None:
    fname = english_filename(unit, kind)
    dest = output_file(grade, fname)
    if skip_existing and dest.exists():
        print(f"  skip {dest.name}")
        return
    chunks = chunk_text(text, MAX_CHARS_PER_CALL)
    body = "\n\n".join(chunks[:2]) if chunks else text
    collected: list[dict] = []
    remaining = target
    batch = 40
    while remaining > 0 and len(collected) < target:
        n = min(batch, remaining)
        system = render(prompt_name, target=n)
        extra = ""
        if collected:
            extra = "\nAlready used answers (do not repeat): " + ", ".join(
                str(x.get("a") or "") for x in collected[-30:]
            )
        user = f"Unit {unit} extract.\n{extra}\n\n{body}"
        raw = client.complete(system, user, json_mode=True)
        grouped = parse_sectioned_questions(raw)
        before = len(collected)
        for item in flatten_grouped(grouped):
            if kind == "mcq":
                clean = validate_mcq(item, 3, include_e=False)
            else:
                clean = validate_english_initial(item)
            if clean:
                collected.append(clean)
        collected = dedupe_questions(collected)
        gained = len(collected) - before
        if gained <= 0:
            break
        remaining = target - len(collected)
    if kind == "mcq":
        collected = shuffle_mcq_answers(collected)
    write_english(grade, unit, kind, collected)
    print(f"  wrote {fname} ({len(collected)} items)")

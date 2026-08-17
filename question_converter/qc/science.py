from __future__ import annotations

import json
from pathlib import Path

from .ai import AIClient
from .balance import dedupe_questions, shuffle_mcq_answers
from .config import MAX_CHARS_PER_CALL, SCIENCE_CHAPTER_TARGET, output_file, science_section_filename
from .parse import chunk_text, is_real_section, parse_sectioned_questions, split_text_by_sections
from .pdf_io import extract_pages, scan_help
from .prompts import render
from .validate import (
    flatten_grouped,
    validate_blank,
    validate_definition,
    validate_formula,
    validate_mcq,
    validate_tf,
)
from .writers import write_quiz, write_science

KIND_FILE = {"tf": "True_False", "blank": "Fill_Blank", "mcq": "MCQ"}
KIND_PROMPT = {"tf": "science_tf.txt", "blank": "science_blank.txt", "mcq": "science_mcq.txt"}
KIND_VALIDATOR = {
    "tf": lambda it: validate_tf(it),
    "blank": lambda it: validate_blank(it),
    "mcq": lambda it: validate_mcq(it, 3),
}


def _target_for_chunk(chunk: str, section_chars: int, chapter_chars: int) -> int:
    lo, hi = SCIENCE_CHAPTER_TARGET
    mid = (lo + hi) // 2
    if chapter_chars <= 0:
        return 20
    share = max(8, int(mid * (len(chunk) / max(section_chars, 1)) * (section_chars / chapter_chars)))
    return max(8, min(28, share))


def _read_json(path: Path) -> list:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def generate_science_book(client: AIClient, book, mapping: dict, skip_existing: bool) -> None:

    subject = mapping["subject"]
    grade = mapping["grade"]
    pdf = Path(mapping["pdf"])

    for ch in mapping["chapters"]:
        num = int(ch["number"])
        start, end = ch["pages"]
        text = extract_pages(pdf, start, end)
        if not text:
            print(f"  ! {book.label} chapter {num}: no text extracted")
            print(scan_help())
            continue

        section_texts: dict[str, str] = {}
        if ch.get("sections"):
            for sec in ch["sections"]:
                s, e = sec["pages"]
                section_texts[sec["id"]] = extract_pages(pdf, s, e)
        else:
            section_texts = split_text_by_sections(text, num)
            if list(section_texts.keys()) == ["all"]:
                section_texts = {f"{num}.1": text}
        section_texts = {
            sid: body
            for sid, body in section_texts.items()
            if sid == "all" or is_real_section(num, sid)
        }
        if not section_texts:
            section_texts = {f"{num}.1": text}

        chapter_chars = sum(len(v) for v in section_texts.values()) or len(text)

        for kind in ("tf", "blank", "mcq"):
            by_section: dict[str, list[dict]] = {}
            for sid, sec_text in section_texts.items():
                fname = science_section_filename(subject, num, sid, KIND_FILE[kind])
                dest = output_file(grade, fname)
                if skip_existing and dest.exists():
                    print(f"  skip {dest.name}")
                    by_section[sid] = _read_json(dest)
                    continue
                items = _generate_kind(client, kind, sid, sec_text, chapter_chars)
                by_section[sid] = items
                write_science(grade, subject, num, sid, KIND_FILE[kind], items)
                print(f"  wrote {fname} ({len(items)} items)")

            combined_name = science_section_filename(subject, num, None, KIND_FILE[kind])
            combined_dest = output_file(grade, combined_name)
            if skip_existing and combined_dest.exists():
                print(f"  skip {combined_dest.name}")
                continue
            combined = []
            for sid in by_section:
                combined.extend(by_section[sid])
            combined = dedupe_questions(combined)
            if kind == "mcq":
                combined = shuffle_mcq_answers(combined)
            write_science(grade, subject, num, None, KIND_FILE[kind], combined)
            print(f"  wrote {combined_name} ({len(combined)} items)")

        _write_reference(client, mapping, num, text, skip_existing)


def _generate_kind(
    client: AIClient,
    kind: str,
    section: str,
    text: str,
    chapter_chars: int,
) -> list[dict]:
    validator = KIND_VALIDATOR[kind]
    collected: list[dict] = []
    chunks = chunk_text(text, MAX_CHARS_PER_CALL)
    for chunk in chunks:
        target = _target_for_chunk(chunk, len(text), chapter_chars)
        system = render(KIND_PROMPT[kind], section=section, target=target)
        user = (
            f"Grade textbook extract for sub-chapter {section}. "
            f"Generate about {target} {kind} questions.\n\n{chunk}"
        )
        raw = client.complete(system, user, json_mode=True)
        grouped = parse_sectioned_questions(raw)
        for item in flatten_grouped(grouped):
            clean = validator(item)
            if clean:
                collected.append(clean)
    collected = dedupe_questions(collected)
    if kind == "mcq":
        collected = shuffle_mcq_answers(collected)
    return collected


def _write_reference(client, mapping, chapter, text, skip_existing) -> None:
    from .parse import loads_json

    subject = mapping["subject"]
    grade = mapping["grade"]
    jobs = [("definition", "science_definition.txt", validate_definition)]
    if subject == "phy":
        jobs.append(("formula", "science_formula.txt", validate_formula))

    chunks = chunk_text(text, MAX_CHARS_PER_CALL)
    for kind, prompt_name, validator in jobs:
        fname = f"{subject}_Chapter_{chapter}_{kind}.json"
        dest = output_file(grade, fname)
        if skip_existing and dest.exists():
            print(f"  skip {dest.name}")
            continue
        items: list[dict] = []
        for chunk in chunks:
            system = render(prompt_name, subject=subject.upper())
            raw = client.complete(system, f"Chapter {chapter} extract:\n\n{chunk}", json_mode=True)
            data = loads_json(raw)
            rows = data if isinstance(data, list) else data.get("items") or data.get("definitions") or data.get("formulas") or []
            if isinstance(data, dict) and not rows:
                # single object mapping titles
                for k, v in data.items():
                    if isinstance(v, str):
                        rows.append({"title": k, "name": k, "content": v})
            for row in rows:
                if isinstance(row, dict):
                    clean = validator(row)
                    if clean:
                        items.append(clean)
        # de-dupe by title/name
        seen = set()
        unique = []
        for it in items:
            key = (it.get("title") or it.get("name") or "").lower()
            if key in seen:
                continue
            seen.add(key)
            unique.append(it)
        write_quiz(grade, fname, unique)
        print(f"  wrote {fname} ({len(unique)} items)")

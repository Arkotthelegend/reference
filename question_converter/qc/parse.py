from __future__ import annotations

import json
import re
from typing import Any

FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.S | re.I)
SECTION_RE = re.compile(r"(?m)^(\d+\.\d+)\s*$")
TRAILING_COMMA_RE = re.compile(r",(\s*[}\]])")


def strip_fences(text: str) -> str:
    text = (text or "").strip()
    blocks = FENCE_RE.findall(text)
    if blocks:
        return max(blocks, key=len).strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        if text.endswith("```"):
            text = text[: -3]
    return text.strip()


def _repair(text: str) -> str:
    text = text.strip()
    text = text.replace("“", '"').replace("”", '"').replace("’", "'")
    text = TRAILING_COMMA_RE.sub(r"\1", text)
    return text


def _first_json_slice(text: str) -> str | None:
    starts = [i for i in (text.find("{"), text.find("[")) if i >= 0]
    if not starts:
        return None
    start = min(starts)
    opener = text[start]
    closer = "}" if opener == "{" else "]"
    depth = 0
    in_str = False
    esc = False
    for i, ch in enumerate(text[start:], start):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == opener:
            depth += 1
        elif ch == closer:
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return text[start:]


def loads_json(text: str) -> Any:
    raw = _repair(strip_fences(text))
    for candidate in (raw, _first_json_slice(raw) or ""):
        if not candidate:
            continue
        try:
            return json.loads(_repair(candidate))
        except json.JSONDecodeError:
            continue
    raise ValueError("Model output was not valid JSON")


def parse_sectioned_questions(text: str) -> dict[str, list[dict]]:
    """Accept a JSON object, a JSON array, or '1.1\\n[...]' blocks."""
    raw = strip_fences(text)
    try:
        data = json.loads(_repair(raw))
        return _normalize_question_payload(data)
    except json.JSONDecodeError:
        pass

    grouped: dict[str, list[dict]] = {}
    matches = list(SECTION_RE.finditer(raw))
    if matches:
        for i, m in enumerate(matches):
            end = matches[i + 1].start() if i + 1 < len(matches) else len(raw)
            chunk = raw[m.end() : end]
            items = loads_json(chunk)
            if not isinstance(items, list):
                raise ValueError(f"Section {m.group(1)} was not a JSON array")
            grouped[m.group(1)] = [x for x in items if isinstance(x, dict)]
        return grouped

    data = loads_json(raw)
    return _normalize_question_payload(data)


def _normalize_question_payload(data: Any) -> dict[str, list[dict]]:
    if isinstance(data, dict):
        if "questions" in data and isinstance(data["questions"], list):
            return {"all": [x for x in data["questions"] if isinstance(x, dict)]}
        out: dict[str, list[dict]] = {}
        for key, val in data.items():
            if isinstance(val, list):
                out[str(key)] = [x for x in val if isinstance(x, dict)]
        if out:
            return out
        if all(k in data for k in ("q", "type")):
            return {"all": [data]}
        raise ValueError("JSON object had no question arrays")
    if isinstance(data, list):
        return {"all": [x for x in data if isinstance(x, dict)]}
    raise ValueError("Unexpected JSON shape")


def looks_like_json_payload(text: str) -> bool:
    try:
        parse_sectioned_questions(text)
        return True
    except Exception:
        try:
            loads_json(text)
            return True
        except Exception:
            return False


def parent_section(number: str) -> str:
    parts = re.split(r"[.\-–]", number.strip())
    parts = [p for p in parts if p]
    if len(parts) >= 2:
        return f"{parts[0]}.{parts[1]}"
    return number.strip()


def is_real_section(chapter: int, key: str) -> bool:
    """Textbook sections are like 1.1 or 7.12, not measurements such as 1.496."""
    parts = key.strip().split(".")
    if len(parts) != 2:
        return False
    try:
        ch, sub = int(parts[0]), int(parts[1])
    except ValueError:
        return False
    return ch == chapter and 1 <= sub <= 30


_BAD_BEFORE = re.compile(
    r"(?i)(figure|fig\.?|table|example|equation|eq\.?|page|see|problem)\s*$"
)


def _is_heading_match(text: str, start: int) -> bool:
    before = text[max(0, start - 24) : start]
    if _BAD_BEFORE.search(before):
        return False
    return True


def find_section_marks(text: str, chapter: int) -> list[tuple[int, str]]:
    """Return (index, '9.2') marks for real sub-chapter headings, including OCR spacing."""
    text = text or ""
    patterns = [
        re.compile(
            rf"(?m)^\s*(?:section\s+)?({chapter})\s*[.\-–]\s*(\d{{1,2}})(?:\s*[.\-–]\s*\d{{1,2}})*\b"
        ),
        re.compile(
            rf"(?m)(?:^|\n)\s*({chapter})\s*[.\-–]\s*(\d{{1,2}})\s+(?:[A-Z(]|\d)"
        ),
    ]
    marks: list[tuple[int, str]] = []
    seen_at: set[tuple[int, str]] = set()
    for pattern in patterns:
        for m in pattern.finditer(text):
            key = f"{m.group(1)}.{m.group(2)}"
            if not is_real_section(chapter, key):
                continue
            if not _is_heading_match(text, m.start()):
                continue
            item = (m.start(), key)
            if item in seen_at:
                continue
            seen_at.add(item)
            marks.append(item)
    marks.sort()
    # Keep first occurrence of each section in textbook order.
    ordered: list[tuple[int, str]] = []
    used: set[str] = set()
    for pos, key in marks:
        if key in used:
            continue
        used.add(key)
        ordered.append((pos, key))
    return ordered


def split_text_by_sections(text: str, chapter: int) -> dict[str, str]:
    """Split textbook text into one-level sections (1.1, 1.2). Deeper ids merge up."""
    text = text or ""
    marks = find_section_marks(text, chapter)
    if not marks:
        return {"all": text.strip()}

    grouped: dict[str, list[str]] = {}
    for i, (pos, key) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        chunk = text[pos:end].strip()
        if chunk:
            grouped.setdefault(key, []).append(chunk)
    return {k: "\n\n".join(v) for k, v in grouped.items() if v}


def chunk_text(text: str, max_chars: int) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]
    chunks: list[str] = []
    paras = re.split(r"\n\s*\n", text)
    buf = ""
    for para in paras:
        extra = ("\n\n" if buf else "") + para
        if buf and len(buf) + len(extra) > max_chars:
            chunks.append(buf)
            buf = para
        else:
            buf += extra
    if buf:
        chunks.append(buf)
    # Hard split any leftover giant paragraph.
    final: list[str] = []
    for chunk in chunks:
        if len(chunk) <= max_chars:
            final.append(chunk)
            continue
        for i in range(0, len(chunk), max_chars):
            final.append(chunk[i : i + max_chars])
    return final

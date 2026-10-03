from __future__ import annotations

import re


BLANK_RE = re.compile(r"_{3,}")


def validate_tf(item: dict) -> dict | None:
    q = str(item.get("q", "")).strip()
    c = str(item.get("c", "")).strip().lower()
    e = str(item.get("e", "")).strip()
    if not q or c not in {"true", "false"}:
        return None
    return {"q": q, "type": "tf", "c": c, "e": e or "See the textbook statement."}


def validate_blank(item: dict) -> dict | None:
    q = str(item.get("q", "")).strip()
    c = str(item.get("c", "")).strip()
    e = str(item.get("e", "")).strip()
    if not q or not c:
        return None
    if "____" not in q and not BLANK_RE.search(q):
        q = q.replace("___", "____")
        if "____" not in q:
            return None
    return {"q": q, "type": "blank", "c": c, "e": e or "See the textbook statement."}


def validate_mcq(item: dict, n_opts: int, include_e: bool = True) -> dict | None:
    q = str(item.get("q", "")).strip()
    opts = item.get("a")
    if not q or not isinstance(opts, list):
        return None
    opts = [str(x).strip() for x in opts if str(x).strip()]
    if len(opts) < n_opts:
        return None
    opts = opts[:n_opts]
    try:
        c = int(item.get("c", 0))
    except (TypeError, ValueError):
        return None
    if not (0 <= c < n_opts):
        return None
    out = {"q": q, "type": "mcq", "a": opts, "c": c}
    if include_e and item.get("e"):
        out["e"] = str(item["e"]).strip()
    return out


def validate_english_initial(item: dict) -> dict | None:
    q = str(item.get("q", "")).strip()
    a = str(item.get("a") or item.get("c") or "").strip()
    if not q or not a:
        return None
    return {"type": "blank", "q": q, "a": a}


def validate_math_show(item: dict) -> dict | None:
    q = str(item.get("q", "")).strip()
    c = str(item.get("c", "")).strip()
    if not q or not c:
        return None
    if "burmese" in c.lower() or re.search(r"[\u1000-\u109F]", q + c):
        return None
    return {"type": "math_show", "q": q, "c": c}


def validate_definition(item: dict) -> dict | None:
    title = str(item.get("title") or item.get("name") or "").strip()
    content = str(item.get("content") or item.get("definition") or "").strip()
    if not title or not content:
        return None
    return {"title": title, "content": content}


def validate_formula(item: dict) -> dict | None:
    name = str(item.get("name") or item.get("formula") or "").strip()
    content = str(item.get("content") or item.get("meaning") or "").strip()
    if not name or not content:
        return None
    return {"name": name, "content": content}


def flatten_grouped(grouped: dict[str, list[dict]]) -> list[dict]:
    items: list[dict] = []
    for key in grouped:
        items.extend(grouped[key])
    return items

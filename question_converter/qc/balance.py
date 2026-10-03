from __future__ import annotations

import random
from collections import Counter


def _is_mcq(item: dict) -> bool:
    return item.get("type") == "mcq" and isinstance(item.get("a"), list)


def shuffle_mcq_answers(items: list[dict], rng: random.Random | None = None) -> list[dict]:
    """Spread correct indexes evenly instead of leaving the model stuck on 0 or 1."""
    rng = rng or random.Random(7)
    out: list[dict] = []
    mcqs = [it for it in items if _is_mcq(it) and it.get("a")]
    if not mcqs:
        return items

    n_opts = max(len(it["a"]) for it in mcqs)
    cycle = list(range(n_opts))
    rng.shuffle(cycle)
    next_target = 0

    for item in items:
        if not _is_mcq(item) or not item.get("a"):
            out.append(item)
            continue
        options = list(item["a"])
        old_c = item.get("c", 0)
        try:
            old_c = int(old_c)
        except (TypeError, ValueError):
            old_c = 0
        if not (0 <= old_c < len(options)):
            old_c = 0
        target = cycle[next_target % len(cycle)]
        next_target += 1
        if target >= len(options):
            target = target % len(options)
        if old_c != target:
            options[old_c], options[target] = options[target], options[old_c]
        new_item = dict(item)
        new_item["a"] = options
        new_item["c"] = target
        out.append(new_item)
    return out


def tf_balance_report(items: list[dict]) -> dict[str, int]:
    counts = Counter()
    for item in items:
        if item.get("type") == "tf":
            val = str(item.get("c", "")).strip().lower()
            counts[val] += 1
    return dict(counts)


def answer_index_report(items: list[dict]) -> dict[int, int]:
    counts: Counter[int] = Counter()
    for item in items:
        if _is_mcq(item):
            try:
                counts[int(item.get("c", 0))] += 1
            except (TypeError, ValueError):
                pass
    return dict(counts)


def dedupe_questions(items: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for item in items:
        key = " ".join(str(item.get("q", "")).lower().split())
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out

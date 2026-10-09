#!/usr/bin/env python3
"""Build quizzes/admin-index.json from the local quiz JSON files.

Questions are git JSON, not Google Sheets. The admin dashboard reads this
index so it does not fetch the whole bank on every open.
"""
from __future__ import annotations

import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
QUIZ_DIR = os.path.join(ROOT, "quizzes")
OUT = os.path.join(QUIZ_DIR, "admin-index.json")
ISSUE_CAP = 400

SUB_PREFIXES = ("phy", "chem", "chme", "bio", "eco", "math", "en", "mm", "eng")


def rel_quiz(path: str) -> str:
    return os.path.relpath(path, ROOT).replace("\\", "/")


def parse_meta(rel: str) -> dict:
    base = os.path.basename(rel)
    stem = re.sub(r"\.(json|jason)$", "", base, flags=re.I)
    grade = 12
    old = False
    kind_extra = ""
    if "/G10/" in rel or stem.startswith(("G10_", "g10_")):
        grade = 10
        stem = re.sub(r"^[Gg]10_?", "", stem)
    elif "/G11/" in rel or stem.startswith(("G11_", "g11_")):
        grade = 11
        stem = re.sub(r"^[Gg]11_?", "", stem)
    if stem.startswith("old_"):
        old = True
        stem = stem[4:]
    if stem.startswith("daily_"):
        kind_extra = "daily"
        stem = stem[6:]

    subject = "other"
    rest = stem
    for pref in SUB_PREFIXES:
        if stem.lower().startswith(pref + "_") or stem.lower() == pref:
            subject = "chem" if pref in ("chme",) else ("en" if pref == "eng" else pref)
            rest = stem[len(pref) :].lstrip("_")
            break

    chapter = ""
    part = ""
    m = re.search(r"Chapter[_-]?(\d+)(?:[_-](\d+\.\d+))?", rest, re.I)
    if m:
        chapter = m.group(1)
        part = m.group(2) or ""
    else:
        um = re.search(r"unit[_-]?(\d+)", rest, re.I)
        if um:
            chapter = um.group(1)

    kind = "other"
    low = rest.lower()
    if "true_false" in low or "မှား" in rest or low.endswith("_tf"):
        kind = "True_False"
    elif "fill_blank" in low or "blank" in low or "ကွက်လပ်" in rest:
        kind = "Fill_Blank"
    elif re.search(r"(^|_)mcq(_|$)", low) or "အမှန်ရွေး" in rest:
        kind = "MCQ"
    elif "definition" in low or "key_term" in low or low.endswith("_def"):
        kind = "definition"
    elif "formula" in low:
        kind = "formula"
    elif re.search(r"\d[-_]marks?", low):
        kind = "math_mark"
    elif kind_extra == "daily":
        kind = "daily"
    elif old:
        kind = kind if kind != "other" else "old"

    if old and kind == "other":
        kind = "old"
    return {
        "path": rel,
        "grade": grade,
        "subject": subject,
        "chapter": chapter,
        "part": part,
        "kind": kind,
        "old": old,
    }


def mcq_answer_ok(q: dict) -> bool:
    opts = q.get("a")
    c = q.get("c")
    if not isinstance(opts, list) or len(opts) < 2:
        return False
    if isinstance(c, int):
        return 0 <= c < len(opts)
    if isinstance(c, str) and c.strip() != "":
        try:
            n = int(c)
            if 0 <= n < len(opts):
                return True
        except ValueError:
            pass
        return any(str(opt).strip() == c.strip() for opt in opts)
    return False


def inspect_question(q, i: int) -> list:
    issues = []
    if not isinstance(q, dict):
        return [{"i": i, "code": "not_object", "detail": "item is not an object"}]
    text = str(q.get("q") or q.get("title") or "").strip()
    if not text:
        issues.append({"i": i, "code": "missing_text", "detail": "no question text"})
    qtype = str(q.get("type") or "").strip().lower()
    if not qtype:
        issues.append({"i": i, "code": "missing_type", "detail": "no type"})
    c = q.get("c")
    if qtype in ("mcq",):
        opts = q.get("a")
        if not isinstance(opts, list) or len(opts) < 2:
            issues.append({"i": i, "code": "bad_options", "detail": "mcq needs at least 2 options"})
        if c is None or c == "":
            issues.append({"i": i, "code": "missing_answer", "detail": "mcq has no correct answer"})
        elif not mcq_answer_ok(q):
            issues.append({"i": i, "code": "bad_answer", "detail": "correct answer does not match options"})
    elif qtype in ("tf", "true_false", "blank"):
        if c is None or str(c).strip() == "":
            issues.append({"i": i, "code": "missing_answer", "detail": "no correct answer"})
    return issues


def fingerprint(q: dict) -> str:
    return (
        str((q or {}).get("type") or "")
        + "\n"
        + str((q or {}).get("q") or "")
        + "\n"
        + str((q or {}).get("c") or "")
    )


def main() -> int:
    files_out = []
    issues = []
    unreadable = []
    issue_counts = defaultdict(int)
    totals_q = 0
    by_subject = defaultdict(lambda: {"files": 0, "questions": 0})
    by_grade = defaultdict(lambda: {"files": 0, "questions": 0})
    by_type = defaultdict(int)
    by_chapter = defaultdict(int)
    seen_fp = {}

    for dirpath, _, names in os.walk(QUIZ_DIR):
        for name in sorted(names):
            if name == "admin-index.json":
                continue
            low = name.lower()
            if not (low.endswith(".json") or low.endswith(".jason")):
                continue
            path = os.path.join(dirpath, name)
            rel = rel_quiz(path)
            meta = parse_meta(rel)
            try:
                with open(path, "r", encoding="utf-8") as fh:
                    data = json.load(fh)
            except Exception as exc:
                unreadable.append({"path": rel, "detail": str(exc)})
                issue_counts["unreadable"] += 1
                if len(issues) < ISSUE_CAP:
                    issues.append(
                        {"path": rel, "i": -1, "code": "unreadable", "detail": str(exc)[:160]}
                    )
                continue
            if not isinstance(data, list):
                unreadable.append({"path": rel, "detail": "not a JSON array"})
                issue_counts["not_array"] += 1
                if len(issues) < ISSUE_CAP:
                    issues.append(
                        {"path": rel, "i": -1, "code": "not_array", "detail": "root is not an array"}
                    )
                continue

            file_issues = 0
            local_fp = {}
            for i, q in enumerate(data):
                totals_q += 1
                qtype = str((q or {}).get("type") or "none")
                by_type[qtype] += 1
                for iss in inspect_question(q, i):
                    file_issues += 1
                    issue_counts[iss["code"]] += 1
                    if len(issues) < ISSUE_CAP:
                        row = dict(iss)
                        row["path"] = rel
                        issues.append(row)
                if isinstance(q, dict):
                    fp = fingerprint(q)
                    if fp.strip("\n"):
                        if fp in local_fp:
                            file_issues += 1
                            issue_counts["duplicate_in_file"] += 1
                            if len(issues) < ISSUE_CAP:
                                issues.append(
                                    {
                                        "path": rel,
                                        "i": i,
                                        "code": "duplicate_in_file",
                                        "detail": "same type+text+answer as item " + str(local_fp[fp]),
                                    }
                                )
                        local_fp[fp] = i
                        prev = seen_fp.get(fp)
                        if prev and prev != rel:
                            file_issues += 1
                            issue_counts["duplicate_cross_file"] += 1
                            if len(issues) < ISSUE_CAP:
                                issues.append(
                                    {
                                        "path": rel,
                                        "i": i,
                                        "code": "duplicate_cross_file",
                                        "detail": "same item also in " + prev,
                                    }
                                )
                        else:
                            seen_fp[fp] = rel

            meta["n"] = len(data)
            meta["issueCount"] = file_issues
            files_out.append(meta)
            by_subject[meta["subject"]]["files"] += 1
            by_subject[meta["subject"]]["questions"] += len(data)
            by_grade[str(meta["grade"])]["files"] += 1
            by_grade[str(meta["grade"])]["questions"] += len(data)
            ch_key = "%s|%s|%s" % (meta["grade"], meta["subject"], meta["chapter"] or "-")
            by_chapter[ch_key] += len(data)

    chapter_rows = []
    for key, n in sorted(by_chapter.items(), key=lambda kv: (-kv[1], kv[0])):
        g, sub, ch = key.split("|")
        chapter_rows.append({"grade": int(g), "subject": sub, "chapter": ch, "questions": n})

    payload = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "quizzes/*.json",
        "idScheme": "file-path + index (JSON items have no id field)",
        "totals": {
            "files": len(files_out),
            "questions": totals_q,
            "unreadable": len(unreadable),
            "issueRows": int(sum(issue_counts.values())),
            "issuesListed": len(issues),
            "issuesCapped": int(sum(issue_counts.values())) > len(issues),
        },
        "bySubject": dict(by_subject),
        "byGrade": dict(by_grade),
        "byType": dict(by_type),
        "byChapter": chapter_rows[:80],
        "issueCounts": dict(issue_counts),
        "files": files_out,
        "issues": issues,
        "unreadable": unreadable,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")
    size = os.path.getsize(OUT)
    print("wrote", rel_quiz(OUT), "bytes", size, "questions", totals_q, "issues", len(issues))
    return 0


if __name__ == "__main__":
    sys.exit(main())

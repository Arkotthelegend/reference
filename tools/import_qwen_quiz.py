#!/usr/bin/env python3
"""Import Qwen share chats into REED quiz JSON files.

No extra AI. Qwen already wrote the items; this script fetches the Share
link (or a saved .txt) and writes Mini App quiz files.

Example — Grade 11 Chemistry chapter 1 from 3 share links:

  python3 tools/import_qwen_quiz.py --grade 11 --sub chem --chapter 1 \\
    --mcq 'https://chat.qwen.ai/s/UUID-MCQ' \\
    --tf  'https://chat.qwen.ai/s/UUID-TF' \\
    --blank 'https://chat.qwen.ai/s/UUID-BLANK'

Writes (and overwrites):
  quizzes/G11/G11_chem_Chapter_1_1.1_MCQ.json
  quizzes/G11/G11_chem_Chapter_1_1.2_MCQ.json
  …
  quizzes/G11/G11_chem_Chapter_1_MCQ.json          (whole chapter)
  same pattern for True_False and Fill_Blank

If a share link cannot be fetched, save the chat as a .txt / .md and pass:
  --mcq ./chem-ch1-mcq.txt

Flags: --dry-run   print files, do not write
       --self-test run parser checks and exit
"""
from __future__ import annotations

import argparse
import json
import re
import ssl
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

MAC_SSL_HELP = """
Mac Python is missing HTTPS certificates. This is a one-time Mac setup, not a bad Qwen link.

Do this:

1. In Finder, open Applications and look for a folder named Python 3.12 (or 3.11 / 3.13).
2. Double-click "Install Certificates.command".
3. Wait until that window finishes, then close it.

Or in Terminal paste:

  python3 -m pip install --upgrade certifi

Then run the import command again.
""".strip()


def ssl_context():
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def is_ssl_error(err) -> bool:
    text = str(err).lower()
    return "certificate" in text or "ssl" in text or "certifi" in text


ROOT = Path(__file__).resolve().parent.parent
TYPE_FILE = {"mcq": "MCQ", "tf": "True_False", "blank": "Fill_Blank"}
GRADE_DIR = {10: "G10", 11: "G11", 12: ""}
GRADE_PREFIX = {10: "G10_", 11: "G11_", 12: ""}
USER_AGENT = "Mozilla/5.0 REED-quiz-import"


class ImportError_(Exception):
    """Raised when a share or file cannot be turned into quiz items."""


def share_id_from(value: str) -> str:
    s = (value or "").strip()
    m = re.search(r"chat\.qwen\.ai/s/(t_[0-9a-fA-F-]+|[0-9a-fA-F-]{8,})", s, re.I)
    if m:
        return m.group(1)
    if re.fullmatch(r"t_[0-9a-fA-F-]+", s, re.I) or re.fullmatch(r"[0-9a-fA-F-]{8,}", s):
        return s
    return ""


def _part_text(part) -> str:
    if isinstance(part, str):
        return part
    if not isinstance(part, dict):
        return ""
    if part.get("phase") in ("thinking", "thinking_summary"):
        return ""
    for key in ("content", "text"):
        val = part.get(key)
        if isinstance(val, str) and val.strip():
            return val
    return ""


def message_content(msg) -> str:
    if not isinstance(msg, dict):
        return ""
    parts = []
    cl = msg.get("content_list")
    if isinstance(cl, list):
        for part in cl:
            t = _part_text(part)
            if t.strip():
                parts.append(t)
    if parts:
        return "\n\n".join(parts)
    c = msg.get("content")
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return "\n".join(_part_text(part) for part in c)
    if isinstance(c, dict) and isinstance(c.get("text"), str):
        return c["text"]
    return ""


def iter_share_messages(body: dict):
    chat = ((body or {}).get("data") or {}).get("chat") or {}
    hist = (chat.get("history") or {}).get("messages")
    if isinstance(hist, dict):
        yield from hist.values()
    elif isinstance(hist, list):
        yield from hist
    messages = chat.get("messages")
    if isinstance(messages, list):
        yield from messages


def assistant_text_from_share(body: dict) -> str:
    chunks = []
    for msg in iter_share_messages(body):
        if isinstance(msg, dict) and msg.get("role") == "assistant":
            chunks.append(message_content(msg))
    text = "\n\n".join(c for c in chunks if c)
    if not text.strip():
        raise ImportError_(
            "Share has no assistant text. Ask your friend to Share the finished chat, not a private /c/ link."
        )
    return text


def fetch_share(share_id: str) -> dict:
    if str(share_id).lower().startswith("t_"):
        url = f"https://chat.qwen.ai/api/v2/share/message/{share_id}"
    else:
        url = f"https://chat.qwen.ai/api/v2/chats/share/{share_id}"
    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, timeout=45, context=ssl_context()) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except HTTPError as err:
        raise ImportError_(f"Qwen share HTTP {err.code} for {url}") from err
    except URLError as err:
        if is_ssl_error(err):
            raise ImportError_(MAC_SSL_HELP) from err
        raise ImportError_(f"Qwen share failed to load: {err}") from err
    if not body or body.get("success") is False:
        raise ImportError_(f"Qwen share failed: {json.dumps(body.get('data') or body)}")
    return body


def load_source(input_path: str) -> dict:
    share_id = share_id_from(input_path)
    if share_id:
        body = fetch_share(share_id)
        return {"kind": "share", "id": share_id, "text": assistant_text_from_share(body)}
    file = Path(input_path).expanduser().resolve()
    if not file.is_file():
        raise ImportError_(f"Not a Qwen share URL or local file: {input_path}")
    return {"kind": "file", "id": str(file), "text": file.read_text(encoding="utf-8")}


def heading_before(text: str, index: int) -> str:
    before = text[:index].rstrip()
    m = re.search(r"(?:^|\n)\s*(?:#{1,6}\s*)?(\d+\.\d+)\s*$", before)
    return m.group(1) if m else ""


def parse_quiz_json(blob: str):
    try:
        return json.loads(blob)
    except json.JSONDecodeError:
        # Friend files often contain TeX like $^\circ C$ — `\c` is not valid JSON.
        fixed = re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', blob)
        return json.loads(fixed)


def extract_json_arrays(text: str) -> list:
    """Return (array, start_index) pairs so a 1.1 heading above the array can be used as sub."""
    found = []
    for m in re.finditer(r"```(?:json)?\s*([\s\S]*?)```", text, re.I):
        try:
            v = parse_quiz_json(m.group(1))
            if isinstance(v, list):
                found.append((v, m.start()))
        except (json.JSONDecodeError, ValueError):
            pass
    if found:
        return found
    start = 0
    while start < len(text):
        frm = text.find("[", start)
        if frm == -1:
            break
        depth = 0
        end = -1
        for i in range(frm, len(text)):
            ch = text[i]
            if ch == "[":
                depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0:
                    end = i
                    break
        if end == -1:
            break
        try:
            parsed = parse_quiz_json(text[frm : end + 1])
            if isinstance(parsed, list) and parsed and isinstance(parsed[0], dict) and parsed[0].get("q"):
                found.append((parsed, frm))
        except (json.JSONDecodeError, ValueError):
            pass
        start = frm + 1
    return found


def tidy_tex(value):
    """Qwen marks 100^\\circ\\text{C} red; MathJax wants 100^{\\circ}\\text{C}."""
    if not isinstance(value, str):
        return value
    return re.sub(r"\^\\circ\b", r"^{\\circ}", value)


def letter_index(ch) -> int:
    s = str(ch or "").strip().upper()
    if not s:
        return -1
    n = ord(s[0]) - 65
    return n if 0 <= n < 26 else -1


def normalize_item(raw, fallback_type, fallback_sub):
    if not isinstance(raw, dict):
        return None
    typ = str(raw.get("type") or fallback_type or "").lower()
    if typ in ("true_false", "truefalse", "true/false"):
        typ = "tf"
    if typ in ("fill_blank", "fill-blank", "fillblank"):
        typ = "blank"
    if typ not in ("mcq", "tf", "blank"):
        return None
    q = tidy_tex(re.sub(r"\s+", " ", str(raw.get("q") or raw.get("question") or "")).strip())
    if not q:
        return None
    sub = str(raw.get("sub") or raw.get("section") or raw.get("subchapter") or fallback_sub or "").strip()
    item = {"type": typ, "q": q}
    if sub:
        item["_sub"] = sub
    if raw.get("e"):
        item["e"] = tidy_tex(str(raw["e"]).strip())

    if typ == "mcq":
        opts = raw.get("a") or raw.get("options") or raw.get("choices")
        if not isinstance(opts, list) or len(opts) < 2:
            return None
        item["a"] = [tidy_tex(str("" if o is None else o).strip()) for o in opts]
        c = raw.get("c")
        if isinstance(c, str) and re.fullmatch(r"[A-Da-d]", c.strip()):
            c = letter_index(c)
        try:
            c = int(c)
        except (TypeError, ValueError):
            return None
        if c < 0 or c >= len(item["a"]):
            return None
        item["c"] = c
    elif typ == "tf":
        ans = raw.get("c")
        if isinstance(ans, bool):
            ans = "true" if ans else "false"
        ans = str("" if ans is None else ans).lower().strip()
        if ans in ("t", "1", "yes"):
            ans = "true"
        if ans in ("f", "0", "no"):
            ans = "false"
        if ans not in ("true", "false"):
            return None
        item["c"] = ans
    else:
        blank = raw.get("c")
        if blank is None:
            a = raw.get("a")
            blank = a if a is not None and not isinstance(a, list) else raw.get("answer")
        if blank is None or str(blank).strip() == "":
            return None
        item["c"] = tidy_tex(str(blank).strip())
    return item


def is_sub_head(line: str) -> str:
    patterns = (
        r"^\s{0,3}#{1,6}\s*(?:sub[- ]?chapter\s*)?(\d+\.\d+)\b",
        r"^\s*(?:sub[- ]?chapter|section)\s*[:.\-]?\s*(\d+\.\d+)\b",
        r"^\s*\*\*(\d+\.\d+)\*\*",
    )
    for pat in patterns:
        m = re.match(pat, line or "", re.I)
        if m:
            return m.group(1)
    return ""


def markdown_one(block: str, fallback_type: str, sub: str):
    text = (block or "").strip()
    if not text:
        return None
    parts = text.split("\n")
    q = (parts.pop(0) if parts else "").strip()
    rest = "\n".join(parts)
    expl = ""
    em = re.search(r"(?:explanation|why|reason)\s*[:：]\s*([\s\S]+)", rest, re.I)
    if em:
        expl = em.group(1).strip()
        rest = rest[: em.start()].strip()
    ans_m = re.search(r"(?:answer|correct|ans)\s*[:：]\s*(.+)$", rest, re.I | re.M)
    ans = ans_m.group(1).strip() if ans_m else ""
    if ans_m:
        rest = (rest[: ans_m.start()] + rest[ans_m.start() + len(ans_m.group(0)) :]).strip()

    opts = []
    for ln in rest.split("\n"):
        om = re.match(r"^\s*(?:[\-\*]\s*)?(?:\(([A-Da-d])\)|([A-Da-d])[\)\.\]])\s+(.+)$", ln)
        if om:
            opts.append(om.group(3).strip())

    typ = fallback_type
    if len(opts) >= 2:
        typ = "mcq"
    elif re.fullmatch(r"(true|false|t|f)", ans, re.I) or (
        re.search(r"\b(true|false)\b", q, re.I) and not opts
    ):
        typ = typ or "tf"
    elif re.search(r"_{3,}", q) or typ == "blank":
        typ = "blank"

    if typ == "mcq":
        ci = letter_index(ans)
        if ci < 0:
            low = ans.lower()
            ci = next((i for i, o in enumerate(opts) if o.lower() == low), -1)
        raw = {"type": "mcq", "q": q, "a": opts, "c": ci, "e": expl, "sub": sub}
    elif typ == "tf":
        raw = {
            "type": "tf",
            "q": re.sub(r"\s*\((true|false)\)\s*$", "", q, flags=re.I),
            "c": ans,
            "e": expl,
            "sub": sub,
        }
    else:
        raw = {"type": "blank", "q": q, "c": ans, "e": expl, "sub": sub}
    return normalize_item(raw, fallback_type, sub)


def parse_markdown(text: str, fallback_type: str) -> list:
    lines = (text or "").replace("\r\n", "\n").split("\n")
    items = []
    sub = ""
    i = 0
    n = len(lines)

    def read_until_next():
        nonlocal i
        buf = []
        i += 1
        while i < n:
            if (
                re.match(r"^\s*\d+[\.\)]\s+\S", lines[i])
                or is_sub_head(lines[i])
                or re.match(r"^```", lines[i])
            ):
                break
            buf.append(lines[i])
            i += 1
        i -= 1
        return "\n".join(buf)

    while i < n:
        head = is_sub_head(lines[i])
        if head:
            sub = head
            i += 1
            continue
        qm = re.match(r"^\s*\d+[\.\)]\s+(.+)$", lines[i])
        if not qm:
            i += 1
            continue
        q = qm.group(1).strip()
        body = read_until_next()
        item = markdown_one(q + "\n" + body, fallback_type, sub)
        if item:
            items.append(item)
        i += 1
    return items


def parse_items(text: str, fallback_type: str) -> list:
    items = []
    for arr, start in extract_json_arrays(text):
        heading = heading_before(text, start)
        for raw in arr:
            extra = None
            if isinstance(raw, dict):
                extra = raw.get("sub") or raw.get("section") or heading
            else:
                extra = heading
            it = normalize_item(raw, fallback_type, extra)
            if it:
                items.append(it)
    if not items:
        items = parse_markdown(text, fallback_type)
    return items


def group_by_sub(items: list, chapter: int) -> dict:
    groups = {}
    for it in items:
        sub = it.get("_sub") or f"{chapter}.1"
        copy = {"type": it["type"], "q": it["q"], "c": it["c"]}
        if "a" in it:
            copy["a"] = it["a"]
        if it.get("e"):
            copy["e"] = it["e"]
        groups.setdefault(sub, []).append(copy)
    return groups


def quiz_dir(grade: int) -> Path:
    folder = GRADE_DIR.get(grade)
    return ROOT / "quizzes" / folder if folder else ROOT / "quizzes"


def file_name(grade: int, sub: str, chapter: int, section: str, type_key: str) -> str:
    prefix = GRADE_PREFIX.get(grade) or ""
    stem = f"{sub}_Chapter_{chapter}"
    if section:
        stem += f"_{section}"
    return f"{prefix}{stem}_{TYPE_FILE[type_key]}.json"


def unique_by_q(items: list) -> list:
    seen = set()
    out = []
    for it in items:
        k = str(it.get("q") or "")
        if k in seen:
            continue
        seen.add(k)
        out.append(it)
    return out


def sort_subs(keys: list) -> list:
    def keyfn(a: str):
        parts = a.split(".")
        try:
            return (int(parts[0]), int(parts[1]) if len(parts) > 1 else 0, a)
        except ValueError:
            return (0, 0, a)

    return sorted(keys, key=keyfn)


def write_json(file: Path, data: list, dry_run: bool) -> dict:
    payload = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    rel = str(file.relative_to(ROOT))
    if dry_run:
        print(f"[dry-run] {file} ({len(data)} items)")
        return {"path": rel, "items": len(data), "dry_run": True}
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(payload, encoding="utf-8")
    print(f"wrote {rel} ({len(data)} items)")
    return {"path": rel, "items": len(data), "dry_run": False}


def import_type(opts: dict, type_key: str, source: str) -> dict:
    loaded = load_source(source)
    items = parse_items(loaded["text"], type_key)
    if not items:
        raise ImportError_(f"No {type_key} items parsed from {source}")
    groups = group_by_sub(items, opts["chapter"])
    directory = quiz_dir(opts["grade"])
    combined = []
    files = []
    for section in sort_subs(list(groups.keys())):
        lst = groups[section]
        fp = directory / file_name(opts["grade"], opts["sub"], opts["chapter"], section, type_key)
        files.append(write_json(fp, lst, opts["dry_run"]))
        combined.extend(lst)
    whole = directory / file_name(opts["grade"], opts["sub"], opts["chapter"], "", type_key)
    files.append(write_json(whole, unique_by_q(combined), opts["dry_run"]))
    return {
        "type": type_key,
        "subs": len(groups),
        "items": len(combined),
        "files": files,
    }


def run_import(grade: int, sub: str, chapter: int, sources: dict, dry_run: bool = False) -> list:
    if grade not in (10, 11, 12):
        raise ImportError_("--grade must be 10, 11, or 12")
    if not sub:
        raise ImportError_("--sub is required (chem, phy, bio, …)")
    if not isinstance(chapter, int) or chapter < 1:
        raise ImportError_("--chapter must be a number")
    if not sources:
        raise ImportError_("Pass at least one of --mcq --tf --blank with a Qwen share URL or a local file.")
    opts = {"grade": grade, "sub": sub.lower(), "chapter": chapter, "dry_run": dry_run}
    results = []
    for key, source in sources.items():
        if not source:
            continue
        results.append(import_type(opts, key, source))
    return results


def self_test() -> None:
    json_text = "```json\n" + json.dumps(
        [
            {
                "sub": "1.1",
                "type": "mcq",
                "q": "Bonds are _____.",
                "a": ["chemical bonds", "gravity", "light"],
                "c": 0,
                "e": "ok",
            },
            {"sub": "1.2", "type": "mcq", "q": "s holds __ electrons.", "a": ["2", "6", "10"], "c": 0},
        ]
    ) + "\n```"
    mcq = parse_items(json_text, "mcq")
    if len(mcq) != 2 or mcq[0].get("_sub") != "1.1" or mcq[0]["c"] != 0:
        raise AssertionError("json mcq parse failed")

    md = "\n".join(
        [
            "## 1.1",
            "1. Atoms are small.",
            "Answer: True",
            "Explanation: they are",
            "",
            "## 1.2",
            "1. The nucleus is empty.",
            "Answer: False",
        ]
    )
    tf = parse_items(md, "tf")
    if len(tf) != 2 or tf[1]["c"] != "false" or tf[0].get("_sub") != "1.1":
        raise AssertionError("markdown tf parse failed")

    blank_md = "\n".join(
        [
            "## 1.1",
            "1. Valence electrons are in the ____.",
            "Answer: outermost shell",
        ]
    )
    blanks = parse_items(blank_md, "blank")
    if len(blanks) != 1 or blanks[0]["c"] != "outermost shell":
        raise AssertionError("markdown blank parse failed")

    headed = "\n".join(
        [
            "1.1",
            '[{"q":"Gas is simple.","type":"tf","c":"true"}]',
            "1.2",
            '[{"q":"Gas is heavy.","type":"tf","c":"false"}]',
        ]
    )
    headed_tf = parse_items(headed, "tf")
    if (
        len(headed_tf) != 2
        or headed_tf[0].get("_sub") != "1.1"
        or headed_tf[1].get("_sub") != "1.2"
    ):
        raise AssertionError("headed json sub parse failed")

    sid = share_id_from(
        "https://chat.qwen.ai/s/t_11e892c9-f711-4195-9256-a5b374ea65bb?fev=0.2.89"
    )
    if sid != "t_11e892c9-f711-4195-9256-a5b374ea65bb":
        raise AssertionError("t_ share id parse failed: " + repr(sid))
    if tidy_tex(r"$100^\circ\text{C}$") != r"$100^{\circ}\text{C}$":
        raise AssertionError("latex tidy failed")
    messy = "1.2\n" + r'[{"q":"Boil at ____ $^\circ C$.","type":"blank","c":"100"}]'
    messy_items = parse_items(messy, "blank")
    if len(messy_items) != 1 or messy_items[0].get("_sub") != "1.2":
        raise AssertionError("invalid tex json parse failed: " + repr(messy_items))
    print("self-test ok")


def parse_cli(argv=None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Import Qwen share chats into REED quiz JSON files.")
    p.add_argument("--grade", type=int, default=11)
    p.add_argument("--sub", default="chem")
    p.add_argument("--chapter", type=int, default=1)
    p.add_argument("--mcq")
    p.add_argument("--tf", "--true-false", dest="tf")
    p.add_argument("--blank", "--fill", "--fill-blank", dest="blank")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--self-test", action="store_true")
    return p.parse_args(argv)


def main(argv=None) -> int:
    args = parse_cli(argv)
    if args.self_test:
        self_test()
        return 0
    sources = {}
    if args.mcq:
        sources["mcq"] = args.mcq
    if args.tf:
        sources["tf"] = args.tf
    if args.blank:
        sources["blank"] = args.blank
    try:
        run_import(args.grade, args.sub, args.chapter, sources, dry_run=args.dry_run)
    except ImportError_ as err:
        print(str(err), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

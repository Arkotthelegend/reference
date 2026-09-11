#!/usr/bin/env python3
"""Local Telegram helper for Qwen → REED quiz files.

You do not need another AI. Qwen already wrote the quizzes. This bot only
fetches public Share links and writes JSON under quizzes/.

Run from the repo root (stdlib only):

  export BOT_TOKEN='123:abc'          # a bot token from @BotFather
  export ADMIN_TELEGRAM_ID='8432363664'  # optional; defaults to that id
  python3 tools/qwen_quiz_bot.py

Then in Telegram:

  /import 11 chem 1
  (bot asks for MCQ share, then True/False, then Fill blank)

Or send all at once:

  11 chem 1
  mcq https://chat.qwen.ai/s/...
  tf https://chat.qwen.ai/s/...
  blank https://chat.qwen.ai/s/...
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from import_qwen_quiz import ImportError_, run_import, share_id_from  # noqa: E402

DEFAULT_ADMIN_ID = "8432363664"
API = "https://api.telegram.org/bot{token}/{method}"

HELP = """No extra AI is needed.

Your friend already wrote the quizzes in Qwen. This bot only:
1. fetches the 3 public Share links
2. splits them by sub-chapter (1.1, 1.2, …)
3. writes the Mini App JSON files

How to import Grade 11 Chemistry chapter 1:

/import 11 chem 1

Then send the 3 Share links when asked (MCQ, True/False, Fill blank).

Or paste everything in one message:

11 chem 1
mcq https://chat.qwen.ai/s/UUID
tf https://chat.qwen.ai/s/UUID
blank https://chat.qwen.ai/s/UUID

Use a Share URL (chat.qwen.ai/s/…), not a private /c/ chat.

/cancel  stop the current import
"""

sessions = {}


def env_token() -> str:
    token = (os.environ.get("BOT_TOKEN") or os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    if not token:
        raise SystemExit("Set BOT_TOKEN to a Telegram bot token from @BotFather.")
    return token


def admin_ids() -> set:
    raw = (os.environ.get("ADMIN_TELEGRAM_ID") or DEFAULT_ADMIN_ID).strip()
    ids = set()
    for part in raw.split(","):
        part = part.strip()
        if part:
            ids.add(part)
    return ids


def tg(token: str, method: str, payload: dict, timeout: int = 60) -> dict:
    url = API.format(token=token, method=method)
    data = json.dumps(payload).encode("utf-8")
    req = Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except HTTPError as err:
        try:
            body = json.loads(err.read().decode("utf-8"))
        except Exception:
            raise RuntimeError(f"Telegram HTTP {err.code}") from err
    if not body.get("ok"):
        raise RuntimeError(body.get("description") or "Telegram API error")
    return body.get("result")


def tg_get(token: str, method: str, params: dict, timeout: int = 70) -> dict:
    url = API.format(token=token, method=method) + "?" + urlencode(params)
    req = Request(url)
    with urlopen(req, timeout=timeout) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    if not body.get("ok"):
        raise RuntimeError(body.get("description") or "Telegram API error")
    return body.get("result")


def reply(token: str, chat_id, text: str) -> None:
    tg(token, "sendMessage", {"chat_id": chat_id, "text": text})


def allowed(user_id) -> bool:
    return str(user_id) in admin_ids()


def parse_meta(text: str):
    m = re.search(r"(?:^|/import\s+)(\d{2})\s+([A-Za-z]+)\s+(\d+)\b", text.strip(), re.I)
    if not m:
        return None
    grade = int(m.group(1))
    if grade not in (10, 11, 12):
        return None
    return {"grade": grade, "sub": m.group(2).lower(), "chapter": int(m.group(3))}


def parse_labeled_urls(text: str) -> dict:
    found = {}
    for key, labels in (
        ("mcq", r"mcq"),
        ("tf", r"(?:tf|true[\s_-]*false|true/false)"),
        ("blank", r"(?:blank|fill[\s_-]*blank|fill)"),
    ):
        m = re.search(rf"(?im)^\s*{labels}\s*[:\-]?\s*(\S+)", text)
        if m:
            found[key] = m.group(1).strip()
    urls = re.findall(r"https?://chat\.qwen\.ai/s/t?_?[0-9a-fA-F-]+", text)
    if len(found) < 3 and len(urls) >= 3:
        found = {"mcq": urls[0], "tf": urls[1], "blank": urls[2]}
    elif len(found) < 3 and len(urls) == 1:
        # leave unlabeled single URL for the conversation step
        pass
    return found


def first_share(text: str) -> str:
    m = re.search(r"https?://chat\.qwen\.ai/s/t?_?[0-9a-fA-F-]+", text or "")
    if m:
        return m.group(0)
    raw = (text or "").strip()
    return raw if share_id_from(raw) else ""


def format_results(results: list) -> str:
    lines = ["Wrote quiz files:"]
    for block in results:
        lines.append(f"\n{block['type']}: {block['items']} items / {block['subs']} sub-chapters")
        for f in block["files"]:
            lines.append(f"• {f['path']} ({f['items']})")
    lines.append("\nCommit and push these files when you are ready.")
    return "\n".join(lines)


def do_import(sess: dict) -> str:
    results = run_import(
        sess["grade"],
        sess["sub"],
        sess["chapter"],
        sess["sources"],
        dry_run=False,
    )
    return format_results(results)


PROMPT = {
    "mcq": "Send the MCQ Qwen Share link (https://chat.qwen.ai/s/…)",
    "tf": "Send the True/False Qwen Share link",
    "blank": "Send the Fill-blank Qwen Share link",
}


def start_import(sess: dict) -> str:
    sess["step"] = "mcq"
    sess["sources"] = sess.get("sources") or {}
    missing = [k for k in ("mcq", "tf", "blank") if not sess["sources"].get(k)]
    if not missing:
        sess["step"] = "idle"
        return do_import(sess)
    sess["step"] = missing[0]
    return (
        f"Import G{sess['grade']} {sess['sub']} chapter {sess['chapter']}.\n\n"
        + PROMPT[sess["step"]]
    )


def handle_text(text: str, chat_id) -> str:
    sess = sessions.setdefault(chat_id, {"step": "idle", "sources": {}})
    raw = (text or "").strip()
    low = raw.lower()

    if low in ("/start", "/help", "help"):
        sess.clear()
        sess.update({"step": "idle", "sources": {}})
        return HELP

    if low in ("/cancel", "cancel"):
        sessions[chat_id] = {"step": "idle", "sources": {}}
        return "Cancelled."

    meta = parse_meta(raw)
    labeled = parse_labeled_urls(raw)
    if meta:
        sess.update(meta)
        if labeled:
            sess["sources"] = labeled
        return start_import(sess)

    if sess.get("step") in ("mcq", "tf", "blank"):
        url = labeled.get(sess["step"]) if labeled else ""
        if not url:
            url = first_share(raw)
        if not url:
            return "That is not a Share link. Send https://chat.qwen.ai/s/… or /cancel"
        sess.setdefault("sources", {})[sess["step"]] = url
        for nxt in ("mcq", "tf", "blank"):
            if not sess["sources"].get(nxt):
                sess["step"] = nxt
                return PROMPT[nxt]
        sess["step"] = "idle"
        try:
            return do_import(sess)
        except ImportError_ as err:
            sess["step"] = "idle"
            return f"Import failed: {err}\n\nAsk your friend to use the JSON prompt in tools/qwen-quiz-prompt.md, then Share again."

    if labeled and sess.get("grade"):
        sess["sources"] = labeled
        return start_import(sess)

    return "Send /import 11 chem 1  then the 3 Qwen Share links.\n/help for details."


def poll_loop(token: str) -> None:
    offset = 0
    print("Qwen quiz bot is polling. Ctrl+C to stop.")
    while True:
        try:
            updates = tg_get(
                token,
                "getUpdates",
                {"timeout": 50, "offset": offset, "allowed_updates": json.dumps(["message"])},
                timeout=70,
            )
        except URLError as err:
            print("network error:", err)
            time.sleep(3)
            continue
        except Exception as err:
            print("getUpdates error:", err)
            time.sleep(3)
            continue
        for upd in updates or []:
            offset = max(offset, int(upd.get("update_id", 0)) + 1)
            msg = upd.get("message") or {}
            chat = msg.get("chat") or {}
            user = msg.get("from") or {}
            chat_id = chat.get("id")
            if chat_id is None:
                continue
            if not allowed(user.get("id")):
                reply(token, chat_id, "This helper only answers the admin account.")
                continue
            text = msg.get("text") or ""
            if not text:
                continue
            try:
                out = handle_text(text, chat_id)
            except ImportError_ as err:
                out = f"Import failed: {err}"
            except Exception as err:
                out = f"Error: {err}"
            try:
                reply(token, chat_id, out)
            except Exception as err:
                print("sendMessage error:", err)


def main() -> int:
    token = env_token()
    try:
        me = tg_get(token, "getMe", {}, timeout=20)
        print("logged in as", me.get("username") or me.get("id"))
    except Exception as err:
        print("Could not reach Telegram:", err, file=sys.stderr)
        return 1
    poll_loop(token)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nstopped")
        raise SystemExit(0)

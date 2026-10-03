#!/usr/bin/env python3
"""Grade 10/11 textbook PDF → quiz JSON converter.

If you run this with the Mac's normal python3, it switches into .venv by itself.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))


def _venv_python() -> Path | None:
    for name in ("python3", "python"):
        candidate = ROOT / ".venv" / "bin" / name
        if candidate.exists():
            return candidate
    return None


def _in_venv() -> bool:
    return sys.prefix != getattr(sys, "base_prefix", sys.prefix)


def _rerun_inside_venv() -> None:
    venv_py = _venv_python()
    if venv_py is None:
        print(
            "I cannot find .venv in this folder.\n"
            "In Terminal paste these lines:\n"
            "  cd /Users/rtx/question_converter\n"
            "  python3 -m venv .venv\n"
            "  source .venv/bin/activate\n"
            "  pip install -r requirements.txt\n"
            "  python3 convert.py --only G10_phy"
        )
        raise SystemExit(1)
    if _in_venv():
        return
    os.execv(str(venv_py), [str(venv_py), str(ROOT / "convert.py"), *sys.argv[1:]])


if __name__ == "__main__":
    _rerun_inside_venv()
    try:
        from qc.cli import main
    except ModuleNotFoundError as extra:
        missing = str(extra)
        print(
            "A Python package is missing. Paste these lines:\n"
            "  cd /Users/rtx/question_converter\n"
            "  source .venv/bin/activate\n"
            "  pip install -r requirements.txt\n"
            "  python3 convert.py --only G10_phy"
        )
        print(f"({missing})")
        raise SystemExit(1) from extra
    raise SystemExit(main())

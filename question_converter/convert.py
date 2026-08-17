#!/usr/bin/env python3
"""Grade 10/11 textbook PDF → quiz JSON converter.

Run from this folder on a Mac:

    python3 convert.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from qc.cli import main

if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from .config import PROMPTS_DIR


@lru_cache(maxsize=32)
def load_prompt(name: str) -> str:
    path = PROMPTS_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Missing prompt file: {path}")
    return path.read_text(encoding="utf-8").strip()


def render(name: str, **kwargs) -> str:
    text = load_prompt(name)
    for key, value in kwargs.items():
        text = text.replace("{{" + key + "}}", str(value))
    return text

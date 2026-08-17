from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path

import requests

from .config import (
    BUDGET_RESERVE_USD,
    CACHE_DIR,
    DEFAULT_MODEL,
    DEFAULT_PROVIDER,
    MAX_OUTPUT_TOKENS,
    MODEL_PRICES,
)


class BudgetExceeded(RuntimeError):
    pass


class AIClient:
    def __init__(
        self,
        provider: str | None = None,
        model: str | None = None,
        budget_usd: float = 10.0,
        cache_dir: Path | None = None,
        temperature: float = 0.35,
    ) -> None:
        self.provider = (provider or os.getenv("QC_PROVIDER") or DEFAULT_PROVIDER).lower()
        self.model = model or os.getenv("QC_MODEL") or DEFAULT_MODEL
        self.budget_usd = float(os.getenv("QC_BUDGET", budget_usd))
        self.spent_usd = 0.0
        self.cache_dir = cache_dir or (CACHE_DIR / "api")
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.temperature = temperature
        self.calls = 0
        self.prompt_tokens = 0
        self.completion_tokens = 0
        self._load_spend()

    def _spend_path(self) -> Path:
        return self.cache_dir / "spend.json"

    def _load_spend(self) -> None:
        path = self._spend_path()
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                self.spent_usd = float(data.get("spent_usd", 0))
                self.calls = int(data.get("calls", 0))
                self.prompt_tokens = int(data.get("prompt_tokens", 0))
                self.completion_tokens = int(data.get("completion_tokens", 0))
            except (OSError, ValueError, TypeError):
                pass

    def _save_spend(self) -> None:
        payload = {
            "spent_usd": round(self.spent_usd, 6),
            "calls": self.calls,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "model": self.model,
            "provider": self.provider,
        }
        self._spend_path().write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def remaining(self) -> float:
        return self.budget_usd - BUDGET_RESERVE_USD - self.spent_usd

    def estimate_cost(self, prompt_tokens: int, completion_tokens: int) -> float:
        inp, out = MODEL_PRICES.get(self.model, (0.15, 0.60))
        return (prompt_tokens / 1_000_000) * inp + (completion_tokens / 1_000_000) * out

    def _cache_key(self, system: str, user: str) -> str:
        h = hashlib.sha256()
        h.update(self.provider.encode())
        h.update(self.model.encode())
        h.update(system.encode())
        h.update(b"\n---\n")
        h.update(user.encode())
        return h.hexdigest()

    def complete(self, system: str, user: str, json_mode: bool = True) -> str:
        key = self._cache_key(system, user)
        cache_file = self.cache_dir / f"{key}.txt"
        if cache_file.exists():
            return cache_file.read_text(encoding="utf-8")

        est_in = _approx_tokens(system + user)
        est_out = min(MAX_OUTPUT_TOKENS, 4000)
        est_cost = self.estimate_cost(est_in, est_out)
        if est_cost > max(self.remaining(), 0):
            raise BudgetExceeded(
                f"Stopped to protect your ${self.budget_usd:.2f} ChatGPT budget "
                f"(spent ${self.spent_usd:.4f}, next call ~${est_cost:.4f}). "
                "Re-run later; finished JSON and cache/ are kept."
            )

        if self.provider != "openai":
            raise ValueError("This converter uses the ChatGPT API only. Set QC_PROVIDER=openai.")

        text, usage = self._openai(system, user, json_mode)
        pt, ct = usage
        self.prompt_tokens += pt
        self.completion_tokens += ct
        self.spent_usd += self.estimate_cost(pt, ct)
        self.calls += 1
        self._save_spend()
        cache_file.write_text(text, encoding="utf-8")
        return text

    def _openai(self, system: str, user: str, json_mode: bool) -> tuple[str, tuple[int, int]]:
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("Set OPENAI_API_KEY in question_converter/.env")
        body: dict = {
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": MAX_OUTPUT_TOKENS,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        data = _post_json(
            "https://api.openai.com/v1/chat/completions",
            body,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )
        text = data["choices"][0]["message"]["content"]
        usage = data.get("usage") or {}
        pt = int(usage.get("prompt_tokens") or _approx_tokens(system + user))
        ct = int(usage.get("completion_tokens") or _approx_tokens(text))
        return text, (pt, ct)


def _post_json(url: str, body: dict, headers: dict, retries: int = 5) -> dict:
    delay = 4
    last_err = None
    for _ in range(retries):
        try:
            res = requests.post(url, json=body, headers=headers, timeout=180)
            if res.status_code in (400, 401, 403, 404):
                raise RuntimeError(f"HTTP {res.status_code}: {res.text[:500]}")
            if res.status_code in (429, 500, 502, 503, 504):
                last_err = RuntimeError(f"HTTP {res.status_code}: {res.text[:400]}")
                time.sleep(delay)
                delay = min(delay * 2, 32)
                continue
            res.raise_for_status()
            return res.json()
        except requests.RequestException as extra:
            last_err = extra
            time.sleep(delay)
            delay = min(delay * 2, 32)
    raise RuntimeError(f"ChatGPT API request failed after retries: {last_err}")


def _approx_tokens(text: str) -> int:
    return max(1, len(text or "") // 4)

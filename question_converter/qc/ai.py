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
    GEMINI_FALLBACKS,
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
        budget_usd: float = 8.0,
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
        inp, out = MODEL_PRICES.get(self.model, (0.10, 0.40))
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
        est_out = MAX_OUTPUT_TOKENS // 2
        est_cost = self.estimate_cost(est_in, est_out)
        if est_cost > max(self.remaining(), 0):
            raise BudgetExceeded(
                f"Stopped to protect your ${self.budget_usd:.2f} budget "
                f"(spent ${self.spent_usd:.4f}, next call ~${est_cost:.4f}). "
                "Re-run later; finished files and the API cache are kept."
            )

        if self.provider == "gemini":
            text, usage = self._gemini(system, user, json_mode)
        elif self.provider == "openai":
            text, usage = self._openai_compat(
                "https://api.openai.com/v1/chat/completions",
                os.getenv("OPENAI_API_KEY", ""),
                system,
                user,
                json_mode,
            )
        elif self.provider == "groq":
            text, usage = self._openai_compat(
                "https://api.groq.com/openai/v1/chat/completions",
                os.getenv("GROQ_API_KEY", ""),
                system,
                user,
                json_mode,
            )
        else:
            raise ValueError(f"Unknown provider '{self.provider}'. Use gemini, openai, or groq.")

        pt, ct = usage
        self.prompt_tokens += pt
        self.completion_tokens += ct
        self.spent_usd += self.estimate_cost(pt, ct)
        self.calls += 1
        self._save_spend()
        cache_file.write_text(text, encoding="utf-8")
        return text

    def _gemini(self, system: str, user: str, json_mode: bool) -> tuple[str, tuple[int, int]]:
        key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not key:
            raise RuntimeError("Set GEMINI_API_KEY in question_converter/.env")
        gen: dict = {
            "temperature": self.temperature,
            "maxOutputTokens": MAX_OUTPUT_TOKENS,
        }
        if json_mode:
            gen["responseMimeType"] = "application/json"
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": gen,
        }
        models = [self.model] + [m for m in GEMINI_FALLBACKS if m != self.model]
        last_err: Exception | None = None
        for model in models:
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{model}:generateContent?key={key}"
            )
            try:
                data = _post_json(url, body, headers={"Content-Type": "application/json"})
                if model != self.model:
                    print(f"  (using Gemini model {model})")
                    self.model = model
                text = _gemini_text(data)
                usage = data.get("usageMetadata") or {}
                pt = int(usage.get("promptTokenCount") or _approx_tokens(system + user))
                ct = int(usage.get("candidatesTokenCount") or _approx_tokens(text))
                return text, (pt, ct)
            except RuntimeError as exc:
                last_err = exc
                if "HTTP 404" not in str(exc) and "HTTP 400" not in str(exc):
                    raise
                continue
        raise RuntimeError(f"Gemini request failed: {last_err}")

    def _openai_compat(
        self,
        url: str,
        api_key: str,
        system: str,
        user: str,
        json_mode: bool,
    ) -> tuple[str, tuple[int, int]]:
        env_name = "OPENAI_API_KEY" if "openai.com" in url else "GROQ_API_KEY"
        if not api_key:
            raise RuntimeError(f"Set {env_name} in question_converter/.env")
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
            url,
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


def _gemini_text(data: dict) -> str:
    cands = data.get("candidates") or []
    if not cands:
        raise RuntimeError(f"Gemini returned no candidates: {data}")
    parts = (((cands[0] or {}).get("content") or {}).get("parts")) or []
    texts = [p.get("text", "") for p in parts if isinstance(p, dict)]
    text = "\n".join(t for t in texts if t).strip()
    if not text:
        raise RuntimeError(f"Gemini returned empty text: {data}")
    return text


def _post_json(url: str, body: dict, headers: dict, retries: int = 5) -> dict:
    delay = 4
    last_err = None
    for _ in range(retries):
        try:
            res = requests.post(url, json=body, headers=headers, timeout=180)
            if res.status_code in (400, 404):
                raise RuntimeError(f"HTTP {res.status_code}: {res.text[:400]}")
            if res.status_code in (429, 500, 502, 503, 504):
                last_err = RuntimeError(f"HTTP {res.status_code}: {res.text[:400]}")
                time.sleep(delay)
                delay = min(delay * 2, 32)
                continue
            res.raise_for_status()
            return res.json()
        except requests.RequestException as exc:
            last_err = exc
            time.sleep(delay)
            delay = min(delay * 2, 32)
    raise RuntimeError(f"API request failed after retries: {last_err}")


def _approx_tokens(text: str) -> int:
    # ~4 chars/token for English+math. Slightly conservative.
    return max(1, len(text or "") // 4)

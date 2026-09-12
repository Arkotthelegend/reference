from __future__ import annotations

import argparse
import sys

from .config import DEFAULT_BUDGET_USD, DEFAULT_MODEL, DEFAULT_PROVIDER, ROOT
from .envload import load_env_file
from .pipeline import run


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="convert.py",
        description="Turn Grade 10/11 textbook PDFs into quiz JSON files using ChatGPT.",
    )
    p.add_argument("--setup-only", action="store_true", help="Ask chapter/page map, do not call the API")
    p.add_argument("--force-setup", action="store_true", help="Re-ask chapter pages even if a map exists")
    p.add_argument("--dry-run", action="store_true", help="Show PDFs and cost estimate only")
    p.add_argument("--model", default=DEFAULT_MODEL, help="Default: gpt-4o-mini (cheap ChatGPT)")
    p.add_argument("--budget", type=float, default=DEFAULT_BUDGET_USD, help="Hard USD stop (default 10)")
    p.add_argument("--force", action="store_true", help="Regenerate even if output JSON already exists")
    p.add_argument("--only", nargs="+", help="Limit to keys like G10_phy G11_en")
    p.add_argument("--reset-spend", action="store_true", help="Forget saved API spend counter in cache/")
    return p


def main(argv: list[str] | None = None) -> int:
    load_env_file(ROOT / ".env")
    args = build_parser().parse_args(argv)
    if args.reset_spend:
        spend = ROOT / "cache" / "api" / "spend.json"
        if spend.exists():
            spend.unlink()
            print(f"Cleared {spend}")
        else:
            print("No saved spend file.")
        return 0
    try:
        return run(
            provider=DEFAULT_PROVIDER,
            model=args.model,
            budget=args.budget,
            skip_existing=not args.force,
            setup_only=args.setup_only,
            force_setup=args.force_setup,
            only_keys=args.only,
            dry_run=args.dry_run,
        )
    except KeyboardInterrupt:
        print("\nStopped.")
        return 130


if __name__ == "__main__":
    sys.exit(main())

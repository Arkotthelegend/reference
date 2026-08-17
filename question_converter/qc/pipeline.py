from __future__ import annotations

from .ai import AIClient, BudgetExceeded
from .config import (
    DEFAULT_BUDGET_USD,
    DEFAULT_MODEL,
    DEFAULT_PROVIDER,
    MATH_1_MARK_COUNT,
    OUTPUT_DIR,
    SCIENCE_CHAPTER_TARGET,
)
from .detect import TextbookPdf, discover_pdfs, expected_slots
from .english import generate_english_book
from .interactive import load_map, setup_book
from .math import generate_math_book
from .pdf_io import page_count
from .science import generate_science_book


def estimate_book_cost(mapping: dict, model: str) -> float:
    client = AIClient(model=model, budget_usd=999)
    chapters = mapping.get("chapters") or []
    n = max(len(chapters), 1)
    subject = mapping["subject"]
    prompt_tok, out_tok = 9200, 3000
    if subject in {"phy", "chem", "bio"}:
        sections = 0
        for ch in chapters:
            sections += max(len(ch.get("sections") or []), 2)
        calls = sections * 3 + n * (2 if subject == "phy" else 1)
    elif subject == "math":
        calls = n * 3
    else:
        calls = n * 5
    return client.estimate_cost(prompt_tok * calls, out_tok * calls)


def print_pdf_inventory(books: list[TextbookPdf]) -> None:
    print("\nPDF inventory")
    print("-" * 40)
    for grade, sub in expected_slots():
        match = next((b for b in books if b.grade == grade and b.subject == sub), None)
        if match:
            try:
                pages = page_count(match.path)
            except Exception:
                pages = "?"
            print(f"  [ok] Grade {grade} {sub:4}  {match.path.name}  ({pages} pages)")
        else:
            print(f"  [  ] Grade {grade} {sub:4}  missing  (put a PDF in pdfs/G{grade}/)")


def run(
    books: list[TextbookPdf] | None = None,
    provider: str = DEFAULT_PROVIDER,
    model: str = DEFAULT_MODEL,
    budget: float = DEFAULT_BUDGET_USD,
    install: bool = True,
    skip_existing: bool = True,
    setup_only: bool = False,
    force_setup: bool = False,
    only_keys: list[str] | None = None,
    dry_run: bool = False,
) -> int:
    books = books if books is not None else discover_pdfs()
    if not books:
        print("No textbooks found. Put PDFs in:")
        print("  question_converter/pdfs/G10/   en.pdf math.pdf phy.pdf chem.pdf bio.pdf")
        print("  question_converter/pdfs/G11/   (same names)")
        print("Filenames can also be like Grade10_Physics.pdf")
        return 1

    print_pdf_inventory(books)
    if only_keys:
        keys = {k.lower() for k in only_keys}
        books = [b for b in books if b.key.lower() in keys or f"g{b.grade}_{b.subject}" in keys]
        if not books:
            print("No PDFs matched --only.")
            return 1

    if dry_run:
        print(f"\nCheap model: {provider} / {model}")
        print(f"Budget cap: ${budget:.2f}")
        for book in books:
            mapping = load_map(book)
            if mapping:
                print(f"  {book.key} estimate ~${estimate_book_cost(mapping, model):.2f}")
            else:
                print(f"  {book.key} has no chapter map yet (run --setup-only first)")
        print("Dry run — not calling the API.")
        return 0

    maps = []
    for book in books:
        mapping = setup_book(book, force=force_setup)
        maps.append((book, mapping))

    if setup_only:
        print("\nChapter maps saved. Run without --setup-only to generate questions.")
        return 0

    total_est = sum(estimate_book_cost(m, model) for _, m in maps)
    print(f"\nCheap model: {provider} / {model}")
    print(f"Budget cap: ${budget:.2f}")
    print(f"Rough cost if nothing is cached: ~${total_est:.2f}")
    print("PDF text is extracted on your Mac (free). API is used only to write questions.")
    print("Re-runs reuse cache/ so you do not pay twice for the same chapter.")

    client = AIClient(provider=provider, model=model, budget_usd=budget)
    print(f"Already spent (saved): ${client.spent_usd:.4f}")

    for book, mapping in maps:
        print(f"\n>>> {book.label}")
        subject = mapping["subject"]
        try:
            if subject in {"phy", "chem", "bio"}:
                generate_science_book(client, book, mapping, install, skip_existing)
            elif subject == "math":
                generate_math_book(client, book, mapping, install, skip_existing)
            else:
                generate_english_book(client, book, mapping, install, skip_existing)
        except BudgetExceeded as exc:
            print(f"  {exc}")
            break
        except Exception as extra:
            print(f"  stopped {book.label}: {extra}")
            break

    print(f"\nDone. API spend this machine: ${client.spent_usd:.4f} across {client.calls} calls")
    print(f"JSON files: {OUTPUT_DIR}")
    if install:
        print("Also copied into quizzes/G10 and quizzes/G11 for the app.")
    print(
        "Science targets "
        f"{SCIENCE_CHAPTER_TARGET[0]}-{SCIENCE_CHAPTER_TARGET[1]} items/chapter; "
        f"math 1-mark {MATH_1_MARK_COUNT[0]}-{MATH_1_MARK_COUNT[1]}."
    )
    return 0

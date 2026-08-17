# question_converter

Turn Grade **10** and Grade **11** Myanmar MoE textbooks (English, Math, Physics, Chemistry, Biology) into the same quiz JSON files this app already uses.

Built to stay inside a small API budget (default **$8**). PDF text is extracted on your Mac for free. The AI is only asked to write questions. Answers are cached so a re-run of the same chapter does not charge you again.

## Output names (same as your existing quizzes)

Science (phy / chem / bio):

- `bio_Chapter_1_1.1_MCQ.json`
- `bio_Chapter_1_1.1_Fill_Blank.json`
- `bio_Chapter_1_1.1_True_False.json`
- `bio_Chapter_1_MCQ.json` (whole chapter)
- Physics also writes `phy_Chapter_10_definition.json` and `phy_Chapter_10_formula.json`
- Chemistry also writes `chem_Chapter_3_definition.json`

Math:

- `math_Chapter_1_1_Mark.json`
- `math_Chapter_1_2_Marks.json`
- `math_Chapter_1_3_Marks.json`

English:

- `en_unit1_mcq.json`
- `en_unit1_initial_letter.json`

Grade 10/11 files are prefixed and stored for the app:

- `quizzes/G10/G10_phy_Chapter_1_MCQ.json`
- `quizzes/G11/G11_en_unit1_mcq.json`

A copy is also kept under `question_converter/output/`.

## Mac setup

```bash
cd question_converter
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Put your Gemini key in `.env`:

```
GEMINI_API_KEY=your_key_here
```

Free keys: [Google AI Studio](https://aistudio.google.com/apikey). Gemini Flash Lite is the default because it is cheap enough for this job. Do **not** use GPT-4 / Gemini Pro — that will burn the $8 budget.

Optional: if a PDF is a scan (no selectable text), install Tesseract for local OCR (still free, no vision API):

```bash
brew install tesseract
pip install pytesseract pillow
```

## Add the 10 PDFs

```
question_converter/pdfs/G10/en.pdf
question_converter/pdfs/G10/math.pdf
question_converter/pdfs/G10/phy.pdf
question_converter/pdfs/G10/chem.pdf
question_converter/pdfs/G10/bio.pdf
question_converter/pdfs/G11/en.pdf
question_converter/pdfs/G11/math.pdf
question_converter/pdfs/G11/phy.pdf
question_converter/pdfs/G11/chem.pdf
question_converter/pdfs/G11/bio.pdf
```

`Grade10_Physics.pdf` / `G11_bio.pdf` style names also work.

## Run

1. Map chapters (Terminal will ask how many chapters/units and which **PDF viewer** pages they use):

```bash
python3 convert.py --setup-only
```

You can paste all ranges at once:

```
1: 5-28
2: 29-51
3: 52-80
```

For Physics / Chemistry / Biology, press Enter on sub-chapters to auto-detect `1.1`, `1.2` from headings, or type `1.1:5-14, 1.2:15-28`.

Maps are saved in `maps/G10_phy.json` so you do not re-type them.

2. Generate questions:

```bash
python3 convert.py
```

Useful flags:

| Flag | Meaning |
| --- | --- |
| `--dry-run` | List PDFs and cost estimate only |
| `--only G10_phy G11_en` | One textbook at a time (recommended with $8) |
| `--budget 8` | Hard stop before overspend |
| `--no-install` | Write only to `output/`, not `quizzes/` |
| `--force` | Rebuild JSON that already exists |
| `--force-setup` | Ask chapter pages again |
| `--provider groq` | Use Groq instead of Gemini |
| `--model gemini-2.0-flash-lite` | Even cheaper Gemini model |

Work **one subject at a time** (`--only G10_bio`) so you can check quality before spending the rest of the budget.

## What the AI is told (from your prompts)

- Questions must come from the pasted textbook, not other books (strict for Phy / Chem / Bio).
- True/False and MCQ answers are mixed. MCQ correct indexes are shuffled so they are not stuck on 0 or 1.
- English: 100+ initial-letter items per unit; MCQ has 3 choices.
- Math 1-mark: 4 choices, 40–50 items, new numbers, concepts from the chapter.
- Math 2-mark / 3-mark: step-by-step HTML, no Burmese, SVG graphs only when needed.
- Science: True/False, fill-blank, MCQ per sub-chapter **and** whole chapter.

After files exist, set the real chapter counts / sub-chapters in `grades.js` for Grade 10 and 11 (those blocks currently copy Grade 12 as a placeholder).

## If something fails

- **No text extracted** — PDF is probably a scan. Install Tesseract as above.
- **Budget stop** — already-written JSON and `cache/` are kept. Re-run; finished chapters are skipped.
- **Bad JSON from the model** — invalid items are dropped; run `--force` on that book after a prompt tweak in `prompts/`.

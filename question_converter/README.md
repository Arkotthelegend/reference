# question_converter

Standalone Mac folder. It does **not** touch the quiz website / `reference` repo. Copy this whole `question_converter` folder onto your Mac and run it there.

It reads Grade 10 and Grade 11 textbook PDFs and writes quiz JSON files using **ChatGPT only** (`gpt-4o-mini` by default, so a $10 credit can last).

## 1. Put this folder on your Mac

```
question_converter/
  convert.py
  pdfs/G10/     ← drop 5 PDFs here
  pdfs/G11/     ← drop 5 PDFs here
  output/       ← JSON appears here
  .env          ← your ChatGPT key (you create this)
```

## 2. ChatGPT key

In Terminal:

```bash
cd ~/question_converter
cp .env.example .env
open -e .env
```

Paste your key as:

```
OPENAI_API_KEY=sk-proj-...
QC_MODEL=gpt-4o-mini
QC_BUDGET=10
```

Keep `.env` only on your Mac. Do not put the key in chat, email, or GitHub.

If you already pasted a key in a chat, revoke it at https://platform.openai.com/api-keys and make a new one.

**Do not use `gpt-4o`.** That model will burn $10 in a few chapters. Stay on `gpt-4o-mini`. For even cheaper, `--model gpt-4.1-nano`.

## 3. Install (once)

```bash
cd ~/question_converter
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

If a PDF is a scan (no selectable text):

```bash
brew install tesseract
pip install pytesseract pillow
```

## 4. Add the 10 PDFs

```
pdfs/G10/en.pdf
pdfs/G10/math.pdf
pdfs/G10/phy.pdf
pdfs/G10/chem.pdf
pdfs/G10/bio.pdf
pdfs/G11/en.pdf
pdfs/G11/math.pdf
pdfs/G11/phy.pdf
pdfs/G11/chem.pdf
pdfs/G11/bio.pdf
```

`Grade10_Physics.pdf` style names also work.

## 5. Run

```bash
source .venv/bin/activate
python3 convert.py --setup-only
```

Terminal asks how many chapters/units and which **PDF viewer** pages they use (page 1 = first page of the file). You can paste:

```
1: 5-28
2: 29-51
```

Then generate **one book at a time**:

```bash
python3 convert.py --only G10_phy
python3 convert.py --only G10_bio
python3 convert.py --only G11_en
```

JSON is written to:

```
output/G10/bio_Chapter_1_1.1_MCQ.json
output/G10/math_Chapter_1_1_Mark.json
output/G10/en_unit1_initial_letter.json
output/G11/...
```

Same naming as your existing quiz files. Nothing is copied into any other project.

## Flags

| Flag | Meaning |
| --- | --- |
| `--setup-only` | Save chapter page maps only |
| `--dry-run` | List PDFs and cost estimate |
| `--only G10_phy` | One textbook |
| `--budget 10` | Hard stop |
| `--force` | Rebuild JSON that already exists |
| `--model gpt-4o-mini` | ChatGPT model |

Finished files and `cache/` are kept if the budget stop hits. Re-run later; those chapters are skipped.

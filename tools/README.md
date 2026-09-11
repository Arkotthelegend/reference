# Qwen → G11 quiz files

Your friend sends 3 Qwen **Share** links per chapter (`https://chat.qwen.ai/s/...`): MCQ, True/False, Fill blank. Each chat holds every sub-chapter (1.1, 1.2, …).

## 1. Give them this prompt

See `qwen-quiz-prompt.md`. Ask them to output one JSON array with a `"sub"` field on every item, then tap **Share**.

## 2. Import into this repo

From the `reference` root:

```bash
node tools/import-qwen-quiz.mjs --grade 11 --sub chem --chapter 1 \
  --mcq 'https://chat.qwen.ai/s/MCQ-SHARE-ID' \
  --tf  'https://chat.qwen.ai/s/TF-SHARE-ID' \
  --blank 'https://chat.qwen.ai/s/BLANK-SHARE-ID'
```

That writes:

- `quizzes/G11/G11_chem_Chapter_1_1.1_MCQ.json` (and 1.2, 1.3, …)
- `quizzes/G11/G11_chem_Chapter_1_MCQ.json` (whole chapter)
- the same pair for `True_False` and `Fill_Blank`

`--dry-run` prints paths without writing. `--self-test` checks the parser.

If a share link will not load, copy the chat into a `.txt` and pass that path instead of the URL.

Same flags work for `--grade 10` / `--grade 12` and `--sub phy` / `bio` / `eco`.

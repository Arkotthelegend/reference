# Qwen → quiz files

**You do not need another AI.** Qwen already wrote the questions. A Python script (or a small Telegram helper) only fetches the public Share links and writes JSON into this repo.

AI is only a fallback if a chat is messy prose with no JSON and no numbered questions. Give your friend `qwen-quiz-prompt.md` so every chat ends as a JSON array with `"sub":"1.1"`.

Your friend sends 3 Qwen **Share** links per chapter (`https://chat.qwen.ai/s/...`): MCQ, True/False, Fill blank. Each chat holds every sub-chapter (1.1, 1.2, …).

## 1. Give them this prompt

See `qwen-quiz-prompt.md`. Ask them to output one JSON array with a `"sub"` field on every item, then tap **Share**.

## 2. Import with Python (recommended)

From the `reference` root. Python 3.8+, **stdlib only** — no pip packages.

```bash
python3 tools/import_qwen_quiz.py --grade 11 --sub chem --chapter 1 \
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

Node is still available if you prefer it:

```bash
node tools/import-qwen-quiz.mjs --grade 11 --sub chem --chapter 1 \
  --mcq 'https://chat.qwen.ai/s/MCQ-SHARE-ID' \
  --tf  'https://chat.qwen.ai/s/TF-SHARE-ID' \
  --blank 'https://chat.qwen.ai/s/BLANK-SHARE-ID'
```

## 3. Optional: local Telegram bot

This is a **separate helper bot you run on your computer**. Do not point it at the live Reed bot token while Cloudflare is using that token (webhook and polling fight each other). Make a second bot with @BotFather, or stop the Worker webhook first.

```bash
export BOT_TOKEN='123:from-BotFather'
export ADMIN_TELEGRAM_ID='8432363664'   # only this Telegram id can import
python3 tools/qwen_quiz_bot.py
```

Then send:

```
/import 11 chem 1
```

The bot asks for the MCQ Share link, then True/False, then Fill blank, and writes the same G11 files.

Or paste one message:

```
11 chem 1
mcq https://chat.qwen.ai/s/...
tf https://chat.qwen.ai/s/...
blank https://chat.qwen.ai/s/...
```

Private `chat.qwen.ai/c/...` links will not work. Use **Share**.

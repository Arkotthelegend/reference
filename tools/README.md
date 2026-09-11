# Qwen → quiz files (paste links, upload by hand)

You do **not** need a GitHub pull request. The script writes JSON into `quiz-upload/`. Copy that folder and upload it yourself.

Paste the **whole** Share link. `?fev=0.2.89` is removed automatically.

## Mac

1. Open Terminal, go to the `reference` folder.
2. Run:

```bash
python3 tools/import_qwen_quiz.py
```

3. Type grade (11), subject (`chem` / `phy` / `bio` / `eco`), chapter number.
4. Paste True/False link, Fill-blank link, then MCQ link. Enter after each.
5. Open `quiz-upload/G11/` (or G10) and upload those files.

Or double-click `tools/Import Quiz.command`.

If you see `CERTIFICATE_VERIFY_FAILED`:

```bash
open "/Applications/Python 3.14/Install Certificates.command"
```

(Use your Python version folder if it is not 3.14.) Then run:

```bash
export SSL_CERT_FILE="$(python3 -c 'import certifi; print(certifi.where())')"
python3 tools/import_qwen_quiz.py
```

## Windows

1. Command Prompt:

```bat
cd %USERPROFILE%\Documents\reference
py tools\import_qwen_quiz.py
```

2. Answer grade / subject / chapter, then paste the 3 whole links.
3. Copy files from `quiz-upload\G11\` and upload them.

Or double-click `tools\Import Quiz.bat`.

## Old one-line command (still works)

Writes to `quiz-upload/` unless you add `--into-repo` (that writes into `quizzes/` for git).

```bash
python3 tools/import_qwen_quiz.py --grade 11 --sub chem --chapter 3 \
  --tf  'https://chat.qwen.ai/s/t_....?fev=0.2.89' \
  --blank 'https://chat.qwen.ai/s/t_....?fev=0.2.89' \
  --mcq 'https://chat.qwen.ai/s/t_....?fev=0.2.89'
```

Private `chat.qwen.ai/c/...` links will not work. Use **Share**.

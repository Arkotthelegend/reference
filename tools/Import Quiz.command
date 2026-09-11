#!/bin/bash
cd "$(dirname "$0")/.."
export SSL_CERT_FILE="$(python3 -c 'import certifi; print(certifi.where())' 2>/dev/null)"
python3 tools/import_qwen_quiz.py
echo
read -r -p "Press Enter to close..."

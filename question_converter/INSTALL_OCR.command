#!/bin/bash
cd "$(dirname "$0")"
echo "Installing Tesseract (free tool that reads scanned textbook pages)..."
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is not installed. Open https://brew.sh and install it first."
  echo "Then double-click this file again."
  read -r _
  exit 1
fi
brew install tesseract
if [ -f .venv/bin/activate ]; then
  source .venv/bin/activate
fi
pip3 install pytesseract pillow
echo
echo "Done. In Terminal run:"
echo "  source .venv/bin/activate"
echo "  python3 convert.py --only G10_phy"
read -r _

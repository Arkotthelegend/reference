#!/bin/bash
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  cat > .env << 'EOF'
OPENAI_API_KEY=paste_your_key_here
QC_PROVIDER=openai
QC_MODEL=gpt-4o-mini
QC_BUDGET=10
EOF
  echo "Created .env"
else
  echo ".env already exists"
fi
open -e .env

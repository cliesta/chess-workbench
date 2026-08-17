#!/usr/bin/env bash

set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

if [[ -n "${NVM_DIR:-}" && -s "$NVM_DIR/nvm.sh" ]]; then
  # nvm is normally a shell function, so scripts must load it explicitly.
  source "$NVM_DIR/nvm.sh"
  if ! nvm use; then
    nvm install
  fi
fi

node --eval "if (Number(process.versions.node.split('.')[0]) < 24) { console.error('Node.js 24 or newer is required. Run: nvm use'); process.exit(1) }"

npm install

echo "Setup complete. Start the application with: npm run dev"

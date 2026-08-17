#!/usr/bin/env bash

set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

if [[ -n "${NVM_DIR:-}" && -s "$NVM_DIR/nvm.sh" ]]; then
  # Keep verification on the Node version recorded by the project.
  source "$NVM_DIR/nvm.sh"
  nvm use
fi

node --eval "if (Number(process.versions.node.split('.')[0]) < 24) { console.error('Node.js 24 or newer is required. Run: nvm use'); process.exit(1) }"

npm run verify


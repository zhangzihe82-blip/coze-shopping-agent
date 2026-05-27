#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

export PORT=5000
export HOST=0.0.0.0

fuser -k 5000/tcp 2>/dev/null || true
sleep 1

exec node server.js

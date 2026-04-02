#!/usr/bin/env bash
# CLI Demo Script
# Exercises all Vector CLI commands in a temp directory and captures output.
#
# Usage:
#   bash tools/cli-demo.sh                  # output to terminal
#   bash tools/cli-demo.sh > output.txt     # output to file
#   bash tools/cli-demo.sh 2>&1 | tee output.txt  # both

set -euo pipefail

VECTOR_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEMO_DIR="$(mktemp -d /tmp/vector-demo-XXXXXX)"
LOG="$VECTOR_ROOT/cli-demo-output.txt"

# Helper: run vector CLI via ts-node from the demo dir
vector() {
  (cd "$DEMO_DIR" && npx --prefix "$VECTOR_ROOT" ts-node --transpile-only "$VECTOR_ROOT/tools/cli-runner.ts" "$@" 2>&1)
}

# Redirect all output to both terminal and log file
exec > >(tee "$LOG") 2>&1

echo "============================================"
echo "  Vector CLI Demo — $(date +%Y-%m-%d)"
echo "  Demo dir: $DEMO_DIR"
echo "============================================"
echo ""

# --- Setup: minimal project ---
echo ">>> Setting up demo project..."
(cd "$DEMO_DIR" && npm init -y > /dev/null 2>&1)
cat > "$DEMO_DIR/package.json" <<'PJSON'
{
  "name": "vector-demo",
  "scripts": {
    "test": "echo '3 tests passed' && exit 0",
    "build": "echo 'build ok' && exit 0"
  }
}
PJSON
echo "Done. Project at $DEMO_DIR"
echo ""

# --- 1. vector init --yes ---
echo "============================================"
echo "  1. vector init --yes"
echo "============================================"
vector init --yes
echo ""
echo ">>> .vector/config.yaml:"
cat "$DEMO_DIR/.vector/config.yaml"
echo ""
echo ">>> .claude/settings.local.json:"
cat "$DEMO_DIR/.claude/settings.local.json"
echo ""

# --- 2. vector run v1 ---
echo "============================================"
echo "  2. vector run v1"
echo "============================================"
vector run v1 || true
echo ""

# --- 3. vector check add (non-interactive) ---
echo "============================================"
echo "  3. vector check add --name lint --run 'echo lint ok'"
echo "============================================"
vector check add --name lint --run "echo lint ok"
echo ""
echo ">>> Updated config.yaml:"
cat "$DEMO_DIR/.vector/config.yaml"
echo ""

# --- 4. vector activate ---
echo "============================================"
echo "  4. vector activate --check lint --on --vector v1"
echo "============================================"
vector activate --check lint --on --vector v1
echo ""
echo ">>> .vector/active.yaml:"
cat "$DEMO_DIR/.vector/active.yaml" 2>/dev/null || echo "(no active.yaml yet)"
echo ""

# --- 5. vector run v1 (with lint) ---
echo "============================================"
echo "  5. vector run v1 (with lint check active)"
echo "============================================"
vector run v1 || true
echo ""

# --- 6. vector report (terminal) ---
echo "============================================"
echo "  6. vector report"
echo "============================================"
vector report || true
echo ""

# --- 7. vector report --format json ---
echo "============================================"
echo "  7. vector report --format json"
echo "============================================"
vector report --format json || true
echo ""

# --- 8. vector report --format markdown ---
echo "============================================"
echo "  8. vector report --format markdown"
echo "============================================"
vector report --format markdown || true
echo ""

# --- 9. vector help ---
echo "============================================"
echo "  9. vector help"
echo "============================================"
vector help || true
echo ""

# --- Cleanup ---
echo "============================================"
echo "  Demo complete!"
echo "  Output saved to: $LOG"
echo "  Demo dir: $DEMO_DIR (not cleaned up)"
echo "============================================"

#!/bin/bash
# Oracle Wrapper - Delegates to the Python implementation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pre-flight Check
check_tool() {
    if ! command -v "$1" &> /dev/null; then
        echo "Error: Required tool '$1' not found. Please install it."
        MISSING_TOOLS=true
    fi
}

MISSING_TOOLS=false
check_tool python3
check_tool gemini
check_tool copilot
check_tool claude
check_tool codex

if [ "$MISSING_TOOLS" = true ]; then
    exit 1
fi

# -- Self-Improvement Loop --
if [[ "$*" == *"--self-improve"* ]]; then
    echo "[Oracle] Starting Self-Improvement Cycle..."
    SELF_PROMPT=$(python3 "${SCRIPT_DIR}/self_improve.py")
    PYTHON_SCRIPT="${SCRIPT_DIR}/oracle_engine.py"
    exec python3 "$PYTHON_SCRIPT" -p "$SELF_PROMPT"
    exit 0
fi

# Check for --models or --list-models flag
if [[ "$*" == *"--models"* ]] || [[ "$*" == *"--list-models"* ]]; then
    PYTHON_SCRIPT="${SCRIPT_DIR}/list_models.py"
    exec python3 "$PYTHON_SCRIPT"
    exit 0
fi

# Execute Unified Engine
PYTHON_SCRIPT="${SCRIPT_DIR}/oracle_engine.py"
exec python3 "$PYTHON_SCRIPT" "$@"

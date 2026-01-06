#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REF_DIR="${SCRIPT_DIR}/../references"
LOG_FILE="${REF_DIR}/usage-log.jsonl"
SUMMARY_SCRIPT="${SCRIPT_DIR}/auto_improve.py"

mkdir -p "${REF_DIR}"
touch "${LOG_FILE}" 2>/dev/null || true

tool="$1"
shift || true

if [ -z "${tool}" ]; then
  echo "usage: track_command.sh <tool> [args...]" >&2
  exit 2
fi

start_ms=$(python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
)

err_tmp=$(mktemp)

set +e
"${tool}" "$@" 2> >(tee "${err_tmp}" >&2)
status=$?
set -e

end_ms=$(python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
)
duration_ms=$(( end_ms - start_ms ))

python3 - <<'PY' "$tool" "$status" "$duration_ms" "$LOG_FILE" "$err_tmp" "$PWD" "$@"
import json, os, re, sys, time

tool = sys.argv[1]
status = int(sys.argv[2])
duration_ms = int(sys.argv[3])
log_file = sys.argv[4]
err_path = sys.argv[5]
cwd = sys.argv[6]
args = sys.argv[7:]

try:
    with open(err_path, 'r', encoding='utf-8', errors='ignore') as f:
        err = f.read()
except Exception:
    err = ""

# Redact common secret patterns
redactions = [
    r'(?i)(token|secret|password|passwd|api[_-]?key|authorization)\\s*[:=]\\s*[^\\s]+' ,
    r'gh[pousr]_[A-Za-z0-9_]+' ,
    r'(?i)bearer\\s+[A-Za-z0-9\\-_.]+' ,
]
for pattern in redactions:
    err = re.sub(pattern, '<redacted>', err)

def redact_arg(arg, next_is_value=False):
    lowered = arg.lower()
    if any(k in lowered for k in ["token", "secret", "password", "passwd", "api_key", "apikey", "authorization"]):
        if "=" in arg:
            key, _, _val = arg.partition("=")
            return f"{key}=<redacted>", False
        if arg.startswith("--"):
            return arg, True
        return "<redacted>", False
    for pattern in redactions:
        if re.search(pattern, arg):
            return "<redacted>", False
    return arg, next_is_value

redacted_args = []
consume_next = False
for arg in args:
    if consume_next:
        redacted_args.append("<redacted>")
        consume_next = False
        continue
    redacted, consume_next = redact_arg(arg)
    redacted_args.append(redacted)

err_first = ""
for line in err.splitlines():
    line = line.strip()
    if line:
        err_first = line[:400]
        break

error_code = ""
if err_first:
    # gh: ... (HTTP 403)
    m = re.search(r'HTTP\\s+(\\d+)', err_first)
    if m:
        error_code = f"http_{m.group(1)}"
    # az: (ErrorCode)
    m = re.search(r'\\(([^)]+)\\)', err_first)
    if m and not error_code:
        error_code = m.group(1)

command = " ".join([tool] + redacted_args).strip()
entry = {
    "ts": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    "tool": tool,
    "cwd": cwd,
    "args": redacted_args,
    "command": command,
    "exit": status,
    "duration_ms": duration_ms,
}
if err_first:
    entry["error_first"] = err_first
if error_code:
    entry["error_code"] = error_code

with open(log_file, 'a', encoding='utf-8') as f:
    f.write(json.dumps(entry, ensure_ascii=True) + "\n")
PY

rm -f "${err_tmp}"

if [ -f "${SUMMARY_SCRIPT}" ]; then
  python3 "${SUMMARY_SCRIPT}" >/dev/null 2>&1 || true
fi

exit "${status}"

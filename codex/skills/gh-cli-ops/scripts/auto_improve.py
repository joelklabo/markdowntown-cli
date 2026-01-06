#!/usr/bin/env python3
import collections
import datetime
import json
import os


SCRIPT_DIR = os.path.dirname(__file__)
REF_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "references"))
LOG_FILE = os.path.join(REF_DIR, "usage-log.jsonl")
OUT_FILE = os.path.join(REF_DIR, "auto-summary.md")
OPS_NOTES = os.path.join(REF_DIR, "gh-ops-notes.md")

MAX_LINES = 500
RECENT_FAILS = 5
SLOW_MS = 30000
RECUR_THRESHOLD = 2


def load_entries():
    if not os.path.exists(LOG_FILE):
        return []
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            lines = f.read().splitlines()
    except Exception:
        return []
    entries = []
    for line in lines[-MAX_LINES:]:
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except Exception:
            continue
        if isinstance(entry, dict):
            entries.append(entry)
    return entries


def signature(entry):
    tool = entry.get("tool") or ""
    args = entry.get("args") or []
    parts = [tool] if tool else []
    for arg in args:
        if not arg or arg.startswith("-") or arg == "<redacted>":
            continue
        parts.append(arg)
        if len(parts) >= 3:
            break
    if not parts and tool:
        parts = [tool]
    return " ".join(parts).strip()


def entry_exit(entry):
    try:
        return int(entry.get("exit", 1))
    except Exception:
        return 1


def format_entry(entry):
    ts = entry.get("ts", "")
    cmd = entry.get("command") or signature(entry) or (entry.get("tool") or "")
    code = entry.get("error_code") or ""
    msg = entry.get("error_first") or ""
    duration = entry.get("duration_ms")
    duration_s = ""
    if isinstance(duration, int):
        duration_s = f"{duration}ms"
    elif isinstance(duration, float):
        duration_s = f"{int(duration)}ms"
    parts = [ts, cmd]
    if code:
        parts.append(code)
    if msg:
        parts.append(msg)
    if duration_s:
        parts.append(duration_s)
    return " | ".join(p for p in parts if p)


def suggestion_for(code, msg):
    code = (code or "").lower()
    msg_lower = (msg or "").lower()
    if "resource not accessible by integration" in msg_lower:
        return "Integration token blocked: try `GITHUB_TOKEN= gh workflow run ...` or unset GITHUB_TOKEN/GH_TOKEN, or replace with a PAT/GitHub App token that has workflow permissions."
    if code == "http_401" or "401" in msg_lower:
        return "Auth failed: run `gh auth login` or `gh auth refresh` and re-check credentials."
    if code == "http_403" or "403" in msg_lower:
        return "Forbidden: verify token scopes (e.g., read:packages) and repo permissions; unset GITHUB_TOKEN before `gh auth refresh`."
    if code == "http_404" or "not found" in msg_lower:
        return "Not found: verify repo/owner, workflow id/name, or environment name."
    if "could not resolve to a repository" in msg_lower:
        return "Repo context issue: run `gh repo view` and ensure the correct repo or set default."
    return ""


def append_ops_notes(lines):
    if not lines or not os.path.exists(OPS_NOTES):
        return
    try:
        with open(OPS_NOTES, "r", encoding="utf-8") as f:
            existing = f.read()
    except Exception:
        existing = ""
    today = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    header = f"## Auto learnings ({today})"
    to_add = []
    for line in lines:
        if line in existing:
            continue
        to_add.append(line)
    if not to_add:
        return
    with open(OPS_NOTES, "a", encoding="utf-8") as f:
        if header not in existing:
            f.write("\n" + header + "\n")
        for line in to_add:
            f.write(line + "\n")


def main():
    entries = load_entries()
    now = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    if not entries:
        with open(OUT_FILE, "w", encoding="utf-8") as f:
            f.write("# Auto summary (generated)\n\n")
            f.write(f"Last updated: {now}\n\n")
            f.write("No usage data yet. Use `scripts/ghx` to run gh commands so learnings accumulate.\n")
        return

    total = len(entries)
    success = sum(1 for e in entries if entry_exit(e) == 0)
    failure = total - success
    success_rate = int(round((success / total) * 100)) if total else 0

    last_success = next((e for e in reversed(entries) if entry_exit(e) == 0), None)
    last_failure = next((e for e in reversed(entries) if entry_exit(e) != 0), None)

    cmd_counts = collections.Counter(signature(e) for e in entries if signature(e))
    error_counts = collections.Counter(
        (e.get("error_code") or "").strip()
        for e in entries
        if entry_exit(e) != 0 and e.get("error_code")
    )

    recent_failures = [e for e in entries if entry_exit(e) != 0][-RECENT_FAILS:]
    slow_entries = [e for e in entries if isinstance(e.get("duration_ms"), int) and e.get("duration_ms") >= SLOW_MS]

    recurring = [(code, count) for code, count in error_counts.items() if count >= RECUR_THRESHOLD]
    recurring.sort(key=lambda x: (-x[1], x[0]))

    suggestions = []
    for code, _count in recurring:
        msg = ""
        for e in reversed(entries):
            if (e.get("error_code") or "").strip() == code:
                msg = e.get("error_first") or ""
                break
        suggestion = suggestion_for(code, msg)
        if suggestion:
            suggestions.append((code, suggestion))

    lines = []
    lines.append("# Auto summary (generated)")
    lines.append("")
    lines.append(f"Last updated: {now}")
    lines.append("")
    lines.append("## Health")
    lines.append(f"- Total commands (last {MAX_LINES}): {total}")
    lines.append(f"- Successes: {success}")
    lines.append(f"- Failures: {failure}")
    lines.append(f"- Success rate: {success_rate}%")
    if last_success:
        lines.append(f"- Last success: {format_entry(last_success)}")
    if last_failure:
        lines.append(f"- Last failure: {format_entry(last_failure)}")
    lines.append("")
    lines.append("## Common commands")
    for cmd, count in cmd_counts.most_common(8):
        lines.append(f"- {cmd} ({count})")
    if not cmd_counts:
        lines.append("- None")
    lines.append("")
    lines.append("## Recurring errors")
    if recurring:
        for code, count in recurring:
            lines.append(f"- {code} ({count})")
    else:
        lines.append("- None")
    if suggestions:
        lines.append("")
        lines.append("## Suggestions")
        for code, suggestion in suggestions:
            lines.append(f"- {code}: {suggestion}")
    if recent_failures:
        lines.append("")
        lines.append("## Recent failures")
        for entry in recent_failures:
            lines.append(f"- {format_entry(entry)}")
    if slow_entries:
        lines.append("")
        lines.append("## Slow commands (>=30s)")
        for entry in slow_entries[-5:]:
            lines.append(f"- {format_entry(entry)}")
    lines.append("")

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines).rstrip() + "\n")

    if suggestions:
        append_ops_notes([f"- {code}: {text}" for code, text in suggestions])


if __name__ == "__main__":
    main()

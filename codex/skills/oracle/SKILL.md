---
name: oracle
description: Parallelized multi-agent critique system using Gemini, Copilot, Claude, and Codex. Decomposes complex engineering tasks into specialized domains and synthesizes a single authoritative report.
---

# Oracle Intelligence Layer

Use this skill to get a deep, multi-model analysis of your code, plans, or architecture.

## Workflow

1. Provide a prompt or a file to analyze.
2. Oracle automatically determines if it needs code context.
3. It decomposes the task into 4 specialized expert domains.
4. It synthesizes the findings into a prioritized Master Report.

## Usage

```bash
# General usage
~/.codex/skills/oracle/scripts/oracle.sh -p "<prompt>"

# Implementation/Refactor (forces code context)
~/.codex/skills/oracle/scripts/oracle.sh --research -p "Refactor auth.ts"

# Fast path (single model)
~/.codex/skills/oracle/scripts/oracle.sh --simple -p "Explain this regex"

# Apply fixes found in the report
~/.codex/skills/oracle/scripts/oracle.sh --apply -p "Fix bugs in main.py"
```

## Configuration

Overrides can be set in `~/.codex/oracle.json` or via environment variables:
- `ORACLE_GEMINI_MODEL`
- `ORACLE_COPILOT_MODEL`
- `ORACLE_CLAUDE_MODEL`
- `ORACLE_CODEX_MODEL`

## Model Selection

- **Primary:** `gemini-3-pro-preview` (Synthesis), `gpt-5.1` (Copilot), `sonnet` (Claude), `gpt-5.2` (Codex).
- All tools run in non-interactive mode with auto-approval for seamless CLI integration.

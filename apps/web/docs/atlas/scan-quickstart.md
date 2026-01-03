# Scan quickstart (Atlas Simulator)

Use Atlas Simulator to confirm which instruction files load for a tool and what to fix next.

![Scan to Workbench flow](../assets/scan-workbench-flow.svg)

Flow overview: scan a folder → review Next steps → open Workbench with tool + cwd prefilled.

## What you need
- A local repo folder to scan.
- A Chromium browser (Chrome/Edge/Arc) for directory picking, or the folder upload input in other browsers.

## 5-minute flow
1. Open **Atlas → Simulator**.
2. Click **Scan a folder** and select your repo root. If the picker is unavailable, use the folder upload input.
3. Confirm the detected tool and cwd (open **Advanced** only if you need to adjust). If you hit a permission error, reopen the picker and grant access.
4. Start with **Next steps** and follow the top action. When the scan is ready, the primary CTA is **Open Workbench**.
5. Click **Open Workbench** to build or export `agents.md` (scan context carries over).

## What you’ll see
- **Summary badges**: Loaded, Missing, Extra, Warnings.
- **Next steps**: prioritized fixes and actions.
- **Instruction health**: tool-specific checks and templates.
- **Content linting (optional)**: formatting warnings for instruction files.
- **Scan metadata**: file counts and truncation status.

## Privacy and data handling
- Scans run locally in your browser. File contents stay on your device.
- Content linting is optional; it only reads allowlisted instruction files and never uploads them.

## Troubleshooting
- **Directory picker not supported** → use the folder upload input (`webkitdirectory`).
- **Permission error** → re-open the picker, grant access, and click **Scan a folder** again.
- **Scan canceled** → click **Scan a folder** to restart the scan.
- **No instruction files found** → add tool-specific files like `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, or `.github/copilot-instructions.md`.
- **Results are out of date** → adjust tool/cwd and click **Refresh results**.
- **Scan truncated** → scan a smaller folder or exclude large directories; some files may be omitted from results.

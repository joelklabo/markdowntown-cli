# Atlas Simulator: Scan a Folder

Use the Atlas Simulator to preview which instruction files load for each tool based on your repo structure.
If you’re new, start with the quickstart: `docs/atlas/scan-quickstart.md`.

## Supported browsers
- Chromium-based browsers (Chrome, Edge, Arc) use the File System Access API for folder picking.
- Other browsers can still scan via the folder upload input (directory upload).

## Privacy and data handling
- Scans run locally in your browser.
- Only file paths are read to locate instruction files.
- File contents are never read, uploaded, or stored server-side by default.
- Optional content linting (opt-in) reads instruction file contents locally to surface formatting issues. Content never leaves your browser.

## Scan flow (quick upload)
1. Open Atlas → Simulator.
2. Click “Scan a folder” and pick your repo (or use the folder upload input in unsupported browsers).
3. The simulator auto-detects the tool and suggests a cwd when possible. Use the Advanced controls to override.
4. Start with Next steps, then review Instruction health, Summary, Loaded files, Insights, Warnings, and the scan metadata.
5. Click “Refresh results” after changing tool/cwd, or when you update files on disk.

## Next steps panel
The Results page starts with Next steps so you always know what to do next.
- Prioritizes fixes (errors → warnings → info).
- Prompts a rescan when results are stale.
- Offers actions like Scan a folder, Paste repo paths, Refresh results, Copy template, Open docs, and Copy summary.
- When everything looks good, it shows a “Ready to go” state so you can share or export confidently.

## Instruction health check
The Instruction health panel validates file placement for the selected tool and highlights missing or misplaced instruction files.
- It shows pass/warn/fail status plus actionable fixes.
- You can copy a template file or jump to Workbench when files are missing.
- Use the Fix summary button to share issues with teammates.
- Next steps pulls its top fixes from Instruction health diagnostics.

See the dedicated guide: `docs/atlas/instruction-health.md`.

## Rules verification
Use the monthly checklist to keep platform rule metadata current:
`docs/atlas/rules-verification.md`.

## Optional content linting
Enable “Content linting (local-only)” to read instruction files locally and surface common formatting issues.
- Only allowlisted instruction paths are read.
- Files larger than 64 KB are skipped or truncated.
- The panel summarizes warnings and suggests fixes (e.g., missing `applyTo` front matter).

## Manual fallback (advanced)
If you can’t access a local folder, open “Paste paths” and paste one repo path per line. You can still select a tool and cwd
manually in the Advanced section.

## Troubleshooting
- “File System Access API isn’t supported”: use the folder upload input instead.
- “Results are out of date”: adjust your inputs and click Refresh results again.
- “No files found”: confirm the repo actually contains instruction files and that ignored folders (like `node_modules`) aren’t hiding them.
- “Scan truncated”: reduce the repo size or move large folders out of the scan scope.

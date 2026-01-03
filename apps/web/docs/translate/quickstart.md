# Translate quickstart

Use Translate to convert Markdown or UAM JSON into tool-ready instruction files.

## Steps
1. Open **Translate** from the main navigation.
2. **Select targets** (step 1). Choose one or more tool targets (Codex, Claude Code, Copilot, etc.).
3. **Paste input** (step 2). Paste Markdown or UAM v1 JSON. The detected format badge updates automatically.
4. **Compile** (step 3). Review the generated file list and any warnings.
5. Use **Open in Workbench** to refine the output or **Download zip** to save it to your repo.

## What gets generated
- Translate creates tool-specific instruction files for each selected target.
- You can export `agents.md` from Workbench or download the zip directly.

## Tips
- Large inputs are capped. If you see a size error, trim the input and retry.
- If you only need one target, keep one selected for a clean zip name.
- UAM v1 JSON should be a valid object matching the UAM schema.

## Troubleshooting
- **No targets selected** → choose at least one supported target.
- **Input invalid** → reformat as Markdown or valid UAM v1 JSON.
- **Rate limit** → wait a moment and retry.
- **Compile failed or timed out** → trim large inputs, retry, or reduce the number of targets.

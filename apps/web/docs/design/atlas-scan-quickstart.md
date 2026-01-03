# Atlas scan quickstart UX + copy

## Goals
- One clear primary action: scan a folder.
- Immediate feedback: auto-scan, tool detection, summary, next steps.
- Progressive disclosure for advanced controls.

## Desktop wireframe (top of page)
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Scan your repo                                                            ⚙ │
│ Scan a folder to see what your tool will load. Scans stay in your browser.  │
│                                                                             │
│ [ Scan a folder ]   or   [ Paste paths ] (secondary)                        │
│                                                                             │
│ Detected: GitHub Copilot  •  4 files found  •  2 missing                    │
│ [Change tool]  [Change cwd]                                                │
│                                                                             │
│ Next steps                                                                  │
│ - Add .github/copilot-instructions.md                                       │
│   [Copy template] [Open docs]                                               │
│ - Rescan a smaller folder                                                   │
│   [Scan smaller folder]                                                     │
│                                                                             │
│ Show advanced ▸                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Mobile wireframe (stacked)
```text
Scan your repo
Scan a folder to see what your tool will load.
Scans stay in your browser.

[ Scan a folder ]
[ Paste paths ]

Detected: GitHub Copilot
4 files found • 2 missing
[ Change tool ]
[ Change cwd ]

Next steps
- Add .github/copilot-instructions.md
  [ Copy template ]
  [ Open docs ]

Show advanced ▸
```

## Advanced controls (collapsed by default)
- Tool selector (dropdown)
- Current directory (cwd) input
- Manual path list input
- Content linting opt-in
- Scan metadata + path preview

## Copy variants
### Empty state
- Title: “Scan your repo”
- Helper: “Scan a folder to see what your tool will load. Scans stay in your browser.”
- Primary CTA: “Scan a folder”
- Secondary CTA: “Paste paths”

### Scanning
- Status: “Scanning your folder…”
- Helper: “This stays local in your browser.”

### Scan complete (auto-detected tool)
- Banner: “Detected: {tool} based on {evidence}.”
- Summary: “Found {foundCount} instruction files. {missingCount} expected files missing.”
- Actions: “Change tool” / “Change cwd”

### Mixed tools detected
- Banner: “Multiple tool formats detected. Choose which tool to validate.”
- Helper: “We found instruction files for more than one CLI.”

### Error states
- Canceled: “Scan canceled. Scan a folder to continue.”
- Unsupported picker: “Your browser doesn’t support folder picking. Use folder upload below.”
- Scan error: “We couldn’t scan that folder. Try again or paste paths.”

## Accessibility notes
- Primary CTA is first in tab order.
- All status text uses live regions for screen reader updates.
- Buttons use clear action verbs.
- Errors are inline with actionable recovery.

## Refactoring notes
- Consolidate scan CTA into a single entry point in the component.
- Remove any duplicate helper text that conflicts with the quickstart copy.

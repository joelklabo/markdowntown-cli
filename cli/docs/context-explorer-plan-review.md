# Context Explorer Plan Review

## 1. Critique of the Gemini Plan

### Critical Issues

#### A. Outdated: Ignores Existing Implementation
The Gemini plan proposes creating components that **already exist**:

| Gemini's Proposed Task | Current Reality |
| -------------------------- | --------------- |
| "Impl: Context Resolution Engine" | ✅ Already exists: `cli/internal/context/engine.go` |
| "Impl: TUI Foundation & File Tree" | ✅ Already exists: `cli/internal/tui/filetree.go`, `model.go` |
| "Impl: CLI Command Wiring" | ✅ Already exists: `cli/cmd/markdowntown/context.go` |
| "Design: Context Explorer Spec" | ⚠️ Partially exists: `cli/docs/context-command-analysis.md` |

**Current State Summary:**
- Context Engine with adapter factory for all 5 clients (Gemini, Codex, Claude, Copilot, VSCode)
- Lazy-loaded file tree with vim-style navigation (j/k/h/l)
- Split pane TUI layout (1/3 tree, 2/3 detail)
- `markdowntown context` command already wired

#### B. Misidentifies "Cloud Code"
The plan assumes "Cloud Code" means "Claude" due to CLAUDE.md presence. This is incorrect:
- "Cloud Code" is **Google Cloud Code** (VS Code extension for GCP)
- The user likely meant **Claude Code** (this CLI tool) which uses CLAUDE.md and `.claude/` dirs
- The existing `ClientClaude` adapter handles Claude context correctly

#### C. Missing What Actually Needs Work
The plan doesn't identify the **real gaps**:

1. **Context display is simulated** - `fetchContextCmd()` in model.go uses hardcoded mock data
2. **No tabbed client views** - UI shows single pane, not tabs for Gemini/Codex/Claude
3. **No test coverage** - `cli/internal/context/` and `cli/internal/tui/` have zero tests
4. **No ignoring integration** - Doesn't show if a file is ignored by `.geminiignore`, etc.
5. **No file-specific resolution** - Engine exists but isn't called with actual file path

### Moderate Issues

#### D. Task Granularity Problems
- "Impl: TUI Foundation & File Tree" bundles 4+ hours of work
- No testing tasks as blockers for implementation
- Missing error handling task (identified in context-command-analysis.md)

#### E. Missing Acceptance Criteria Details
Tasks lack specific verification steps:
- No screenshot paths defined
- No specific test commands
- No CI verification steps

---

## 2. Improved Plan: Context Explorer Completion

### Objective
Connect the existing TUI shell to real context resolution and add tabbed client views.

### Success Criteria
- [ ] Selecting a file shows real resolved context from the Context Engine
- [ ] Tab navigation between Gemini, Codex, and Claude views
- [ ] Context panel shows: resolved instruction files, ignored status, warnings
- [ ] Unit tests for context engine and TUI components
- [ ] CI passes (lint, test, build)

### Architecture (Existing + New)

```text
cli/cmd/markdowntown/context.go  ← EXISTS, wires command
         ↓
cli/internal/tui/model.go        ← EXISTS, needs integration
         ↓
cli/internal/context/engine.go   ← EXISTS, fully implemented
         ↓
cli/internal/instructions/*.go   ← EXISTS, adapters for each client
```

**What's Missing:**
```text
cli/internal/tui/tabs.go         ← NEW: Tab component
cli/internal/tui/context_panel.go← NEW: Renders Resolution data
cli/internal/context/engine_test.go ← NEW: Unit tests
cli/internal/tui/*_test.go       ← NEW: TUI tests
```

### Revised Task Tree

```text
markdowntown-cli-873 Epic: Context Explorer Completion
│
├─── Core TUI Path (Sequential)
│    ├── markdowntown-cli-874 Test: Add context engine unit tests
│    ├── markdowntown-cli-875 Impl: Connect TUI to real context engine
│    ├── markdowntown-cli-876 Impl: Add client tabs (all 5 clients)
│    ├── markdowntown-cli-877 Impl: Render resolved context details
│    ├── markdowntown-cli-878 Test: Add TUI component tests
│    └── markdowntown-cli-879 Docs: Update USER_GUIDE
│
├─── JSON Output (Parallel after engine tests)
│    └── markdowntown-cli-880 [P1] Impl: Add JSON output mode
│
├─── Advanced Features (After context details)
│    ├── markdowntown-cli-881 Impl: Compare mode (cross-client diff)
│    ├── markdowntown-cli-882 Impl: Config validation integration
│    └── markdowntown-cli-883 [P3] Impl: Search across instructions
```

### Supported Clients (All 5)
1. **Gemini** - GEMINI.md, .gemini/, .geminiignore
2. **Claude** - CLAUDE.md, .claude/, .claudeignore
3. **Codex** - .codex/, instructions, skills
4. **Copilot** - .github/copilot-instructions.md
5. **VS Code** - .vscode/settings.json AI sections

### Detailed Task Specifications

---

#### Task 1: Add context engine unit tests

**Description:**
Add unit tests for the existing context engine before modifying behavior.

**Files:**
- `cli/internal/context/engine_test.go` (create)

**Acceptance Criteria:**
- Tests verify `ResolveContext` returns results for all 3 clients
- Tests verify error handling when adapter fails
- `go test ./internal/context/...` passes

**CI:** `cd cli && make test`

---

#### Task 2: Connect TUI to real context engine

**Description:**
Replace simulated `fetchContextCmd` with actual context engine calls.

**Files:**
- `cli/internal/tui/model.go` (modify: replace mock with engine call)
- `cli/internal/context/engine.go` (no changes, just integration)

**Acceptance Criteria:**
- Selecting a file triggers real `engine.ResolveContext()`
- Results display in right pane (raw format OK for now)
- Error states show proper messages

**CI:** `cd cli && make test && make build`

---

#### Task 3: Add client tabs component

**Description:**
Create tab component for switching between Gemini/Codex/Claude views.

**Files:**
- `cli/internal/tui/tabs.go` (create)
- `cli/internal/tui/model.go` (modify: integrate tabs)

**Acceptance Criteria:**
- Tab bar renders at top of right pane
- Arrow keys or 1/2/3 switch tabs
- Active tab is visually highlighted

**CI:** `cd cli && make build`

---

#### Task 4: Render resolved context details

**Description:**
Format Resolution data into readable display (instruction files, ignored status, warnings).

**Files:**
- `cli/internal/tui/context_panel.go` (create)
- `cli/internal/tui/model.go` (modify: use context_panel)

**Acceptance Criteria:**
- Shows list of applied instruction files with paths
- Shows ignored status per client
- Shows warnings/errors if config is malformed
- Truncated files marked with indicator

**CI:** `cd cli && make build`

---

#### Task 5: Add TUI component tests

**Description:**
Add tests for TUI components to ensure maintainability.

**Files:**
- `cli/internal/tui/filetree_test.go` (create)
- `cli/internal/tui/tabs_test.go` (create)

**Acceptance Criteria:**
- FileTree tests: navigation, expansion, selection
- Tabs tests: switching, rendering
- `go test ./internal/tui/...` passes

**CI:** `cd cli && make test`

---

#### Task 6: Update documentation

**Description:**
Document the context command in user guide.

**Files:**
- `cli/docs/USER_GUIDE.md` (modify)
- `cli/docs/screenshots/context-explorer.png` (create)

**Acceptance Criteria:**
- Command usage documented
- Screenshot shows TUI in action
- Keybindings documented

**CI:** `make lint` (markdown lint)

---

## 3. Key Differences from Gemini Plan

| Aspect | Gemini Plan | Improved Plan |
| ------ | ----------- | ------------- |
| Context Engine | Create from scratch | Use existing, add tests |
| TUI Foundation | Create from scratch | Use existing, connect properly |
| CLI Wiring | Create from scratch | Already done |
| Focus | Building structure | Connecting components + polish |
| Testing | Mentioned vaguely | Explicit test-first tasks |
| Dependencies | Linear chain | Test tasks as blockers |

---

## 4. Research Insights (Web Search)

### BubbleTea Testing Best Practices
Source: [Tips for building Bubble Tea programs](https://leg100.github.io/en/posts/building-bubbletea-programs/), [Catwalk testing library](https://github.com/knz/catwalk)

- Use **catwalk** for datadriven TUI tests (reference input/output files)
- Debug with `tea.LogToFile("debug.log", "debug")` since stdout is occupied
- Target >80% test coverage
- Use `WithoutSignals` option in tests

### Claude Code Context Resolution
Source: [Claude Code CLAUDE.md files](https://claude.com/blog/using-claude-md-files), [Claude Code settings](https://code.claude.com/docs/en/settings)

- CLAUDE.md loads hierarchically: `~/.claude/CLAUDE.md` → project root → subdirectory
- Files under 100 lines work best (token efficiency)
- `.claude/settings.json` configures permissions and tool behavior
- Use `/init` to reload after CLAUDE.md changes

### Answers to Key Questions

1. **Ignore pattern visualization**: Include in Task 4 (context details) - show which patterns cause ignore
2. **CLI-only JSON mode**: Add as future enhancement, TUI is primary goal
3. **Tabs**: Start with user-specified 3 (Gemini, Codex, Claude), make extensible
4. **Large contexts**: Use viewport scrolling (lipgloss viewport component)

---

## 5. Final Recommendations

1. **Test-First Approach**: Task 1 creates tests before modifying engine behavior
2. **Incremental Delivery**: Each task produces working software
3. **Use Catwalk**: For TUI tests, use datadriven test files
4. **Keep Tasks Small**: Each task is 1-3 hours of focused work
5. **CI Gates**: Every task must leave `make lint && make test` passing

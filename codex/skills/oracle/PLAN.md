# Oracle Self-Optimization Blueprint

## 1. Evaluation & History (`.oracle/history`)
To enable long-term learning, Oracle now archives all synthesis reports.
- **Storage:** JSON/Markdown metadata in `~/.oracle/history/`.
- **Structure:**
  - `report-{uuid}.md`: The final output.
  - `meta-{uuid}.json`: Contains the prompt, decomposition plan, agent outputs, and critic scores.
- **Usage:** A future "Critic" agent can scan this folder to find patterns of failure (e.g., "Copilot consistently fails on Rust code").

## 2. Recursive Prompt Tuning
Automated improvement of agent personas.
- **Trigger:** When `validate_decomposition` returns low confidence or synthesis fails.
- **Mechanism:**
  1. The "Meta-Analyst" agent reads the failed `meta-{uuid}.json`.
  2. It generates a "Patch" for `oracle-decomposition-prompt.txt`.
  3. Example: "Add a constraint to the 'Security Specialist' to ignore test files."
- **Implementation:** A new `--auto-tune` flag in `oracle.sh`.

## 3. Knowledge Base (Memory)
Avoid repeating research on the same files.
- **Vector Store:** Use a lightweight local embedding (e.g., `chromadb` or simple cosine sim on cached embeddings) stored in `~/.oracle/memory`.
- **Lookup:** Before "Phase 2: Research", check if a similar query + file context exists.
- **Retrieval:** Inject the *summary* of the previous finding instead of spinning up a new agent.

## 4. UI State Machine (The "Spruced Up" Dashboard)
Refactored `oracle_common.py` to use a `UIManager` singleton.
- **State:** `IDLE` | `SPINNING` | `DASHBOARD_ACTIVE`.
- **Components:**
  - **Header:** "Memory: {usage} | Active Agents: {count}"
  - **Stream:** Logs appear *above* the dashboard.
  - **Footer:** Animated spinner + current phase (e.g., "Synthesizing...").
- **Fix:** Prevents spinner duplication by strictly controlling `sys.stdout` via the `UIManager` lock.

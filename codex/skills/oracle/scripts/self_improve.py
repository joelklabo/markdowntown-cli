#!/usr/bin/env python3
import json
import os
from pathlib import Path
from datetime import datetime

HISTORY_DIR = Path(".oracle/history")

def get_recent_history(limit=5):
    if not HISTORY_DIR.exists():
        return "No history found."
    
    files = sorted(HISTORY_DIR.glob("run_*.json"), key=os.path.getmtime, reverse=True)
    recent = files[:limit]
    
    summaries = []
    for f in recent:
        try:
            data = json.loads(f.read_text())
            # Clean up the prompt for the summary to avoid huge nested prompts
            prompt_snip = data.get("prompt", "")[:200].replace("\n", " ")
            summary = {
                "timestamp": f.name.replace("run_", "").replace(".json", ""),
                "prompt_snippet": prompt_snip,
                "elapsed": data.get("elapsed"),
                "decomposition": data.get("decomposition", {}).get("domains", []),
                "results": data.get("results_summary", [])
            }
            summaries.append(summary)
        except: continue
        
    return json.dumps(summaries, indent=2)

def main():
    history = get_recent_history()
    
    improvement_prompt = f"""You are the Oracle Meta-Optimizer. 
Analyze the following execution history from recent Oracle runs.

## Execution History
{history}

## Your Task
1.  **Identify Patterns:** Are there specific types of requests that frequently fail or take too long?
2.  **Evaluate Decomposition:** Is the planning phase identifying the right domains, or is it being too generic?
3.  **Propose Enhancements:** Based on this data, propose specific edits to:
    *   `prompts/oracle-decomposition-prompt.txt`
    *   `prompts/oracle-synthesis-prompt.txt`
    *   `scripts/oracle_common.py` (e.g., adding more keywords to complexity detection)
    *   `scripts/oracle_engine.py` (e.g., tweaking timeouts or fallback priority)

Provide a prioritized list of improvements to make Oracle faster, smarter, and more resilient."""

    print(improvement_prompt)

if __name__ == "__main__":
    main()

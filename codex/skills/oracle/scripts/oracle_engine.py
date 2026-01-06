#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
import shutil
import sys
import time
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

# Import Shared Logic
from oracle_common import (
    log, run_command, build_research_context, 
    sanitize_context, Spinner, detect_complexity, apply_diff_from_text, 
    detect_context_needs, classify_error, ErrorType, UIManager, save_run_history,
    Color
)

# --- Configuration ---
SCRIPT_DIR = Path(__file__).resolve().parent
PROMPT_DIR = SCRIPT_DIR.parent / "prompts"
DECOMPOSITION_PROMPT_FILE = PROMPT_DIR / "oracle-decomposition-prompt.txt"
SYNTHESIS_PROMPT_FILE = PROMPT_DIR / "oracle-synthesis-prompt.txt"
CRITIC_PROMPT_FILE = PROMPT_DIR / "oracle-critic-prompt.txt"

# Default Models
GEMINI_MODEL = os.environ.get("ORACLE_GEMINI_MODEL", "gemini-3-pro-preview")
COPILOT_MODEL = os.environ.get("ORACLE_COPILOT_MODEL", "gpt-5.1-codex-max") 
CLAUDE_MODEL = os.environ.get("ORACLE_CLAUDE_MODEL", "sonnet")
CODEX_MODEL = os.environ.get("ORACLE_CODEX_MODEL", "gpt-5.2")

BANNER = f"""{Color.PURPLE}{Color.BOLD}
   ____                 _      
  / __ \\               | |     
 | |  | |_ __ __ _  ___| | ___ 
 | |  | | '__/ _` |/ __| |/ _ \\
 | |__| | | | (_| | (__| |  __/
   \\____/|_|  \\__,_|\\___|_|\\___|
 {Color.CYAN}  Intelligence Layer v3.0{Color.RESET}
"""

# Load config
config_path = Path.home() / ".codex" / "oracle.json"
if config_path.exists():
    try:
        config = json.loads(config_path.read_text())
        GEMINI_MODEL = os.environ.get("ORACLE_GEMINI_MODEL", config.get("gemini_model", GEMINI_MODEL))
        COPILOT_MODEL = os.environ.get("ORACLE_COPILOT_MODEL", config.get("copilot_model", COPILOT_MODEL))
        CLAUDE_MODEL = os.environ.get("ORACLE_CLAUDE_MODEL", config.get("claude_model", CLAUDE_MODEL))
        CODEX_MODEL = os.environ.get("ORACLE_CODEX_MODEL", config.get("codex_model", CODEX_MODEL))
    except Exception: pass

# --- Agents ---

def run_gemini(prompt: str, model: str = GEMINI_MODEL, timeout: int = 300) -> str:
    cmd = ["gemini", "-p", prompt, "--approval-mode", "yolo", "--output-format", "text", "-m", model]
    return run_command(cmd, timeout=timeout)

def run_copilot(prompt: str, model: str = COPILOT_MODEL, timeout: int = 300) -> str:
    cmd = ["copilot", "-p", prompt, "--model", model, "-s", "--allow-all-tools"]
    return run_command(cmd, timeout=timeout)

def run_claude(prompt: str, model: str = CLAUDE_MODEL, timeout: int = 300) -> str:
    env = os.environ.copy()
    env.update({"CLAUDE_WATCHER_ENABLED": "0", "CLAUDE_NO_WATCH": "1", "CLAUDE_CODE_DISABLE_ATTACHMENTS": "1"})
    cmd = ["claude", "--print", prompt, "--output-format", "text", "--model", model, "--permission-mode", "dontAsk", "--no-session-persistence"]
    return run_command(cmd, env=env, timeout=timeout)

def run_codex(prompt: str, model: str = CODEX_MODEL, timeout: int = 300) -> str:
    cmd = ["codex", "exec", "--model", model, "--skip-git-repo-check", "--dangerously-bypass-approvals-and-sandbox", prompt]
    return run_command(cmd, timeout=timeout)

PROVIDERS = {
    "Gemini": (run_gemini, GEMINI_MODEL),
    "Copilot": (run_copilot, COPILOT_MODEL),
    "Claude": (run_claude, CLAUDE_MODEL),
    "Codex": (run_codex, CODEX_MODEL)
}

# --- Resilient Dispatcher ---

def execute_with_fallback(prompt: str, primary_name: str, timeout: int, exclude: List[str] = None) -> str:
    if exclude is None: exclude = []
    priority = [primary_name, "Copilot", "Codex", "Gemini", "Claude"]
    chain = [p for p in priority if p not in exclude]
    if not chain: raise RuntimeError(f"All providers exhausted: {exclude}")

    current = chain[0]
    func, model_id = PROVIDERS[current]
    try:
        return func(prompt, model_id, timeout)
    except Exception as e:
        err_text = str(e)
        etype = classify_error(err_text)
        if etype == ErrorType.AUTH_FAILURE: raise
        if len(chain) > 1:
            fallback_to = chain[1]
            log(f"Provider {current} failed ({etype.name}). Falling back to {fallback_to}...", "warn")
            return execute_with_fallback(prompt, fallback_to, timeout, exclude + [current])
        raise

def extract_json(text: str) -> Dict[str, Any]:
    try:
        match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL)
        if match: return json.loads(match.group(1))
        match = re.search(r'(\{.*\})', text, re.DOTALL)
        if match: return json.loads(match.group(1))
        return json.loads(text)
    except Exception as e:
        raise ValueError(f"JSON Error: {e}")

# --- Logic ---

def main():
    parser = argparse.ArgumentParser(description="Oracle Unified Engine")
    parser.add_argument("-p", "--prompt", help="User prompt")
    parser.add_argument("-f", "--file", help="Prompt file")
    parser.add_argument("--research", action="store_true", help="Force research mode")
    parser.add_argument("--apply", action="store_true", help="Apply diffs")
    parser.add_argument("--simple", action="store_true", help="Single agent")
    parser.add_argument("--no-context", action="store_true", help="Disable workspace context injection")
    parser.add_argument("--context-root", help="Override workspace root for context injection")
    parser.add_argument("--timeout", type=int, default=300, help="timeout")
    args = parser.parse_args()

    user_prompt = ""
    if args.file: user_prompt = Path(args.file).read_text(encoding="utf-8")
    elif args.prompt: user_prompt = args.prompt
    else:
        if sys.stdin.isatty(): parser.print_help(); return 1
        user_prompt = sys.stdin.read()

    if not user_prompt: log("No prompt provided.", "error"); return 1

    ui = UIManager()
    if ui.verbosity > 0: print(BANNER)
    
    start_time = time.time()
    
    # 1. Context & Memory
    context_root = Path(args.context_root).expanduser().resolve() if args.context_root else None
    needs_context = (args.research or detect_context_needs(user_prompt)) and not args.no_context
    if needs_context:
        ui.start_spinner("Gathering Workspace Intelligence")
        user_prompt_with_ctx = build_research_context(user_prompt, context_root)
        ui.stop_spinner()
        log("Context Injection: Enabled", "success")
    else:
        user_prompt_with_ctx = f"<user_request>\n{sanitize_context(user_prompt)}\n</user_request>"
        log("Context Injection: Disabled (Abstract Mode)", "info")

    # Simple Mode
    if args.simple:
        log("Mode: Fast Track (Single Agent)", "purple")
        ui.start_spinner("Thinking")
        try:
            out = execute_with_fallback(f"Task:\n{user_prompt_with_ctx}", "Codex", args.timeout)
            ui.stop_spinner()
            print("\n" + "="*60 + "\n" + out + "\n" + "="*60 + "\n")
        except Exception as e:
            ui.stop_spinner()
            log(f"Failed: {e}", "error")
        return

    # Deep Research Mode
    log("Mode: Deep Synthesis", "purple", bold=True)
    
    # 2. Decomposition with Clarification Gate
    ui.start_spinner("Decomposing Objectives")
    decomp_plan = {}
    try:
        tmpl = DECOMPOSITION_PROMPT_FILE.read_text().replace("{{USER_PROMPT}}", user_prompt_with_ctx)
        raw = execute_with_fallback(tmpl, "Gemini", args.timeout)
        decomp_plan = extract_json(raw)
        
        # --- CLARIFICATION GATE ---
        if "clarification_needed" in decomp_plan:
            ui.stop_spinner()
            log("Initial analysis suggests more information is required.", "warn", bold=True)
            print(f"\n{Color.BOLD}Questions for you:{Color.RESET}")
            for q in decomp_plan["clarification_needed"]:
                print(f" {Color.YELLOW}•{Color.RESET} {q}")
            print(f"\n{Color.DIM}Tip: Call Oracle again with an updated prompt including these details.{Color.RESET}")
            print(f"{Color.DIM}Or re-run with --simple to skip decomposition.{Color.RESET}\n")
            return 0

        if CRITIC_PROMPT_FILE.exists():
            ui.update_spinner("Validating Analysis Plan")
            critic_tmpl = (
                CRITIC_PROMPT_FILE.read_text()
                .replace("{{USER_PROMPT}}", user_prompt)
                .replace("{{DECOMPOSITION_JSON}}", raw)
                .replace("{{USER_CONTEXT_SUMMARY}}", "Context injected.")
            )
            critic_raw = execute_with_fallback(critic_tmpl, "Codex", 60)
            critic_res = extract_json(critic_raw)
            if not critic_res.get("pass", True):
                log("Self-Correction: Refining plan based on critic feedback...", "warn")
                tmpl += f"\n\n## Internal Critic Feedback\n{critic_res.get('retry_guidance')}"
                raw = execute_with_fallback(tmpl, "Gemini", args.timeout)
                decomp_plan = extract_json(raw)
    except Exception as e:
        ui.stop_spinner()
        log(f"Planning failed: {e}", "error")
        return 1
    ui.stop_spinner()

    # 3. Swarm Analysis
    domains = decomp_plan.get("domains", [])
    if not isinstance(domains, list):
        log("Malformed decomposition: 'domains' is not a list.", "error")
        return 1
        
    log(f"Phase 2: Deep Research Swarm ({len(domains)} experts)", "info")
    
    results = []
    auth_alerts = []
    
    ui.start_spinner("Orchestrating Parallel Research")
    with ThreadPoolExecutor(max_workers=4) as executor:
        future_map = {}
        for i, d in enumerate(domains):
            if not isinstance(d, dict):
                log(f"Skipping malformed domain entry at index {i}", "warn")
                continue
                
            specs = ["Claude", "Copilot", "Gemini", "Codex"]
            primary = specs[i % len(specs)]
            role = d.get('agent_role', d.get('role', 'Expert'))
            task = d.get('prompt', d.get('task', 'Provide a report.'))
            name = d.get('name', f'Agent {i+1}')
            
            fp = f"Persona: {role}\n\nTask: {task}\n\nContext:\n{user_prompt_with_ctx}"
            future_map[executor.submit(execute_with_fallback, fp, primary, args.timeout)] = (name, primary)

        for future in as_completed(future_map):
            name, primary_rn = future_map[future]
            try:
                out = future.result()
                results.append({"domain": name, "content": out})
                log(f"{name} completed", "success")
            except Exception as e:
                err = str(e)
                if classify_error(err) == ErrorType.AUTH_FAILURE:
                    auth_alerts.append(f"Login required for {primary_rn}")
                results.append({"domain": name, "content": f"ERROR: {err}"})
                log(f"{name} failed definitively", "error")
    ui.stop_spinner()

    # 4. Synthesis
    log("Phase 3: Final Synthesis", "info")
    ui.start_spinner("Merging Expert Findings")
    final_report = ""
    try:
        reports = "".join([f"\n### {r['domain']}\n{r['content']}\n" for r in results])
        syn_prompt = SYNTHESIS_PROMPT_FILE.read_text().replace("{{USER_PROMPT}}", user_prompt_with_ctx).replace("(Reports will be injected here)", reports)
        final_report = execute_with_fallback(syn_prompt, "Gemini", args.timeout)
    except Exception as e:
        log(f"Synthesis failed: {e}", "error")
        final_report = "Failure in Synthesis."
    ui.stop_spinner()

    # Final Output
    print("\n" + "="*60 + "\n" + final_report + "\n" + "="*60 + "\n")
    elapsed = time.time() - start_time
    log(f"Success! Intelligence Report Generated in {elapsed:.1f}s", "success", bold=True)
    
    if args.apply:
        log("Applying code changes...", "purple")
        print(apply_diff_from_text(final_report))

    if auth_alerts:
        print("\n" + "!"*40 + "\n AUTH ALERTS: " + ", ".join(set(auth_alerts)) + "\n" + "!"*40 + "\n")

    # Learning Loop: Save History
    save_run_history({
        "prompt": user_prompt,
        "elapsed": elapsed,
        "decomposition": decomp_plan,
        "results_summary": [{"name": r['domain'], "len": len(r['content'])} for r in results],
        "synthesis_len": len(final_report)
    })

if __name__ == "__main__":
    sys.exit(main())

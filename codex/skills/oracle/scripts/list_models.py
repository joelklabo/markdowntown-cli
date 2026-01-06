#!/usr/bin/env python3
import shutil
import subprocess
import sys
import re

def get_copilot_models():
    """Extracts model list from copilot --help"""
    # Try generic 'copilot'
    cmd = ["copilot", "--help"]
    
    # Fallback to absolute path if found in typical locations (Mac/Linux)
    if not shutil.which("copilot"):
        for path in ["/opt/homebrew/bin/copilot", "/usr/local/bin/copilot"]:
            if shutil.which(path):
                cmd = [path, "--help"]
                break
    
    try:
        res = subprocess.run(cmd, capture_output=True, text=True)
        # Regex to find: --model <model> ... (choices: "a", "b", "c")
        # Copilot output might wrap lines, so re.DOTALL is good.
        match = re.search(r'--model <model>.*?choices: ([^)]+)', res.stdout, re.DOTALL)
        if match:
            raw = match.group(1).replace("\n", "").replace('"', "")
            return [m.strip() for m in raw.split(",")]
    except Exception as e:
        # print(f"DEBUG: {e}") 
        pass
        
    # Fallback hardcoded list if dynamic detection fails (so user sees SOMETHING)
    return [
        "claude-sonnet-4.5", "claude-haiku-4.5", "claude-opus-4.5",
        "claude-sonnet-4", "gpt-5", "gpt-5.1", 
        "gpt-5.1-codex-mini", "gpt-5.1-codex-max", 
        "gemini-3-pro-preview"
    ]

def main():
    print("=== Oracle Available Models (Best Candidates) ===\n")
    
    # 1. Copilot (GH Copilot CLI)
    print("## GitHub Copilot CLI")
    c_models = get_copilot_models()
    if c_models:
        for m in c_models:
            print(f"  - {m}")
    else:
        print("  (Copilot CLI not found)")
    print()

    # 2. Gemini
    print("## Gemini CLI")
    print("  (Known supported models)")
    known_gemini = [
        "gemini-3-pro-preview (Recommended - Reasoning)",
        "gemini-2.0-flash-thinking-exp",
        "gemini-2.0-pro-exp",
        "gemini-1.5-pro"
    ]
    for m in known_gemini:
        print(f"  - {m}")
    print()

    # 3. Claude
    print("## Claude CLI")
    print("  (Standard Anthropic aliases)")
    known_claude = [
        "sonnet (Recommended)",
        "opus",
        "haiku",
        "claude-3-5-sonnet-20241022"
    ]
    for m in known_claude:
        print(f"  - {m}")
    print()
    
    # 4. Codex
    print("## Codex CLI")
    print("  (Detected & Known Models)")
    known_codex = [
        "gpt-5.2 (Recommended - Default)",
        "gpt-5.2-codex",
        "gpt-5.1",
        "o3-mini",
        "gpt-4o"
    ]
    for m in known_codex:
        print(f"  - {m}")
    print()
    
    print("To use a specific model, update ~/.codex/oracle.json or set env vars:")
    print("  export ORACLE_COPILOT_MODEL=gpt-5.1")
    print("  export ORACLE_GEMINI_MODEL=gemini-3-pro-preview")
    print("  export ORACLE_CODEX_MODEL=gpt-5.2")
    print()

if __name__ == "__main__":
    main()

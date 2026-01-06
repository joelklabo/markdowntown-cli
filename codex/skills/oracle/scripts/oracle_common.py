import json
import os
import subprocess
import shutil
import platform
import html
import re
import sys
import time
import threading
import itertools
import tempfile
import ast
from pathlib import Path
from typing import List, Dict, Any, Optional
from enum import Enum, auto
from dataclasses import dataclass, asdict, field
from datetime import datetime

# --- Constants & Config ---

SKIP_DIRS = {
    ".git", "node_modules", ".next", ".turbo", ".cache", ".venv", "venv",
    "dist", "build", "out", ".output", ".idea", ".vscode", ".DS_Store", "__pycache__"
}
IGNORED_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.pdf', '.exe', '.dll', '.so', 
    '.o', '.pyc', '.zip', '.tar', '.gz', '.woff', '.woff2', '.ttf'
}

ORACLE_DIR = Path(".oracle")
HISTORY_DIR = ORACLE_DIR / "history"

# --- UI & Colors ---

class Color:
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    PURPLE = "\033[95m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RESET = "\033[0m"

class UIManager:
    """Thread-safe UI manager handling spinners and logging."""
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(UIManager, cls).__new__(cls)
            cls._instance.lock = threading.Lock()
            cls._instance.spinner = None
            cls._instance.verbosity = int(os.environ.get("ORACLE_VERBOSITY", "1"))
            spinner_env = os.environ.get("ORACLE_SPINNER", "0").lower()
            spinner_allowed = spinner_env not in {"0", "false", "off", "no"}
            cls._instance.spinner_enabled = spinner_allowed and sys.stdout.isatty() and cls._instance.verbosity > 0
        return cls._instance

    def log(self, message: str, level: str = "info", bold: bool = False):
        if self.verbosity == 0: return
        
        prefix = f"{Color.DIM}oracle{Color.RESET} "
        color = Color.RESET
        if level == "success": color = Color.GREEN; message = f"✓ {message}"
        elif level == "warn": color = Color.YELLOW; message = f"⚠ {message}"
        elif level == "error": color = Color.RED; message = f"✗ {message}"
        elif level == "info": color = Color.CYAN; message = f"• {message}"
        elif level == "purple": color = Color.PURPLE; message = f"✧ {message}"
        
        msg = f"{prefix}{color}{message}{Color.RESET}"
        if bold: msg = f"{Color.BOLD}{msg}{Color.RESET}"

        with self.lock:
            if self.spinner and self.spinner.is_running:
                sys.stdout.write("\r" + " " * 100 + "\r")
                print(msg)
            else:
                print(msg)

    def start_spinner(self, message: str):
        if not self.spinner_enabled:
            self.log(message, "info")
            return
        old_spinner = None
        with self.lock:
            if self.spinner:
                self.spinner.request_stop()
                old_spinner = self.spinner
            self.spinner = Spinner(message, self.lock)
            self.spinner.start()
        if old_spinner:
            old_spinner.wait_stopped()

    def update_spinner(self, message: str):
        if not self.spinner_enabled:
            self.log(message, "info")
            return
        with self.lock:
            if self.spinner:
                self.spinner.update(message)

    def stop_spinner(self):
        old_spinner = None
        with self.lock:
            if self.spinner:
                self.spinner.request_stop()
                old_spinner = self.spinner
                self.spinner = None
        if old_spinner:
            old_spinner.wait_stopped()

def log(msg: str, level: str = "info", bold: bool = False):
    UIManager().log(msg, level, bold)

class Spinner:
    def __init__(self, message, lock):
        self.message = str(message) if message is not None else ""
        self.lock = lock
        self.stop_event = threading.Event()
        self.thread = threading.Thread(target=self._spin, daemon=True)
        self.is_running = False

    def _spin(self):
        chars = itertools.cycle(["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"])
        while not self.stop_event.is_set():
            with self.lock:
                sys.stdout.write(f"\r{Color.DIM}oracle{Color.RESET} {Color.YELLOW}{self.message}{Color.RESET}... {Color.BOLD}{Color.PURPLE}{next(chars)}{Color.RESET}")
                sys.stdout.flush()
            time.sleep(0.08)
        with self.lock:
            sys.stdout.write("\r" + " " * (len(self.message) + 25) + "\r")
            sys.stdout.flush()

    def start(self):
        self.is_running = True
        self.thread.start()

    def request_stop(self):
        self.stop_event.set()
        self.is_running = False

    def wait_stopped(self):
        try: self.thread.join(timeout=0.5)
        except: pass

    def stop(self):
        self.request_stop()
        self.wait_stopped()

    def update(self, message):
        self.message = str(message) if message is not None else ""

# --- Error Handling ---

class ErrorType(Enum):
    RATE_LIMIT = auto()
    AUTH_FAILURE = auto()
    SERVER_ERROR = auto()
    SYNTAX_ERROR = auto()
    UNKNOWN = auto()

def classify_error(stderr: str) -> ErrorType:
    patterns = {
        ErrorType.RATE_LIMIT: r"(429|quota exceeded|throttl|capacity|resource exhausted|rate limit|usage limit)",
        ErrorType.AUTH_FAILURE: r"(401|403|gh auth login|claude login|gemini auth login|codex login|authentication required|re-authenticate|invalid api key|access denied|expired token)",
        ErrorType.SERVER_ERROR: r"(500|502|503|504|overloaded|bad gateway|internal server error|service unavailable)",
        ErrorType.SYNTAX_ERROR: r"(400|parse error|malformed|unknown model|invalid argument)"
    }
    text = stderr.lower()
    for etype, pattern in patterns.items():
        if re.search(pattern, text): return etype
    return ErrorType.UNKNOWN

# --- History & Learning ---

def save_run_history(data: Dict[str, Any]):
    try:
        HISTORY_DIR.mkdir(parents=True, exist_ok=True)
        ts_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = HISTORY_DIR / f"run_{ts_str}.json"
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        log(f"Failed to save history: {{e}}", "warn")

# --- Resource Management ---

class TokenBudget:
    _instance = None
    def __new__(cls, max_tokens=100000):
        if cls._instance is None:
            cls._instance = super(TokenBudget, cls).__new__(cls)
            cls._instance.max_tokens = int(os.environ.get("ORACLE_TOKEN_BUDGET", max_tokens))
            cls._instance.current_usage = 0
        return cls._instance
    def check(self, est: int):
        if self.current_usage + est > self.max_tokens:
            log(f"Token budget nearing limit ({{self.current_usage}}/{{self.max_tokens}})", "warn")
        self.current_usage += est

def run_command(cmd: List[str], env: Optional[Dict[str, str]] = None, timeout: int = 300) -> str:
    TokenBudget().check(sum(len(a) for i, a in enumerate(cmd) if i > 0) // 4)
    try:
        res = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=timeout)
        if res.returncode != 0:
            raise RuntimeError(res.stderr.strip() or f"Exit {{res.returncode}}")
        return res.stdout.strip()
    except FileNotFoundError: raise RuntimeError(f"Tool not found: {{cmd[0]}}")
    except subprocess.TimeoutExpired: raise RuntimeError(f"Timed out: {' '.join(cmd)}")
    except Exception as e: raise RuntimeError(str(e))

def sanitize_context(text: str) -> str:
    return html.escape(text, quote=False).replace("<context>", "&lt;context&gt;").replace("</context>", "&lt;/context&gt;")

def apply_diff_from_text(text: str) -> str:
    diff_blocks = re.findall(r'```(?:diff|patch)\s*(.*?)```', text, re.DOTALL)
    if not diff_blocks: return "No diffs found."
    applied, errors = 0, []
    for i, content in enumerate(diff_blocks):
        try:
            with tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.patch') as tmp:
                tmp.write(content)
                p = tmp.name
            try:
                r = subprocess.run(["patch", "-p1", "-i", p], capture_output=True, text=True)
                if r.returncode == 0: applied += 1
                else:
                    r0 = subprocess.run(["patch", "-p0", "-i", p], capture_output=True, text=True)
                    if r0.returncode == 0: applied += 1
                    else: errors.append(f"Block {{i+1}} failed: {{r.stderr.strip()}}")
            finally: 
                if os.path.exists(p): os.remove(p)
        except Exception as e: errors.append(f"Block {{i+1}} error: {{e}}")
    return f"Applied {{applied}}/{{len(diff_blocks)}} diffs."

def detect_complexity(prompt: str) -> Dict[str, Any]:
    keywords = ["architecture", "security", "design", "refactor", "migration", "strategy", "scale", "performance", "risk", "audit", "optimization", "system", "infrastructure"]
    wc = len(prompt.split())
    has_kw = any(k in prompt.lower() for k in keywords)
    is_c = wc > 40 or has_kw
    return {"is_complex": is_c, "reason": "Length" if wc > 40 else ("Keywords" if has_kw else "Simple")}

def detect_context_needs(prompt: str) -> bool:
    kw = ["refactor", "fix", "bug", "error", "exception", "traceback", "function", "class", "method", "variable", "import", "export", "file", "folder", "directory", "path", "script", "config", ".py", ".js", ".ts", ".md", ".json", ".sh", ".html", ".css"]
    return any(k in prompt.lower() for k in kw)

# --- Nuclear Context 2.0 (Injection) ---

class ContextInjector:
    def __init__(self, root: Optional[Path] = None):
        self.max_bytes = int(os.environ.get("ORACLE_RESEARCH_MAX_BYTES", "20000"))
        self.max_total = int(os.environ.get("ORACLE_RESEARCH_MAX_TOTAL_BYTES", "250000"))
        self.current_size = 0
        env_root = os.environ.get("ORACLE_CONTEXT_ROOT")
        if root:
            self.root = Path(root).expanduser().resolve()
        elif env_root:
            self.root = Path(env_root).expanduser().resolve()
        else:
            self.root = Path.cwd()
            try:
                r = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True, stderr=subprocess.DEVNULL).strip()
                self.root = Path(r)
            except:
                pass

    def _get_ast_summary(self, content: str) -> str:
        try:
            tree = ast.parse(content)
            summary = []
            for node in tree.body:
                if isinstance(node, ast.ClassDef):
                    summary.append(f"class {node.name}")
                    for sub in node.body:
                        if isinstance(sub, ast.FunctionDef):
                            summary.append(f"  def {sub.name}")
                elif isinstance(node, ast.FunctionDef):
                    summary.append(f"def {node.name}")
            return "\n".join(summary)
        except: return "(AST parsing failed)"

    def _read_file(self, p: Path, ast_only: bool = False) -> Optional[str]:
        if self.current_size >= self.max_total or not p.exists() or p.is_symlink() or not p.is_file() or p.suffix.lower() in IGNORED_EXTENSIONS: return None
        try:
            d = p.read_bytes()
            tr = False
            if len(d) > self.max_bytes: d = d[:self.max_bytes]; tr = True
            if self.current_size + len(d) > self.max_total:
                rem = self.max_total - self.current_size
                if rem <= 0: return None
                d = d[:rem]; tr = True
            
            txt = d.decode("utf-8", errors="ignore")
            self.current_size += len(d)
            rel = p.relative_to(self.root)
            header = f"--- File: {{rel}} ({{len(d)}} bytes" + (", truncated" if tr else "") + ") ---\n"
            if ast_only and p.suffix == '.py':
                txt = self._get_ast_summary(txt)
            return header + txt + "\n--- end ---\n"
        except: return None

    def _get_tree(self) -> str:
        lines = []
        try:
            for it in sorted(self.root.iterdir(), key=lambda p: p.name.lower()):
                if it.name in SKIP_DIRS or it.is_symlink(): continue
                if it.is_dir():
                    lines.append(f"{it.name}/")
                    try:
                        c = [x.name + ("/" if x.is_dir() else "") for x in sorted(it.iterdir()) if x.name not in SKIP_DIRS][:15]
                        if c: lines.append("  - " + ", ".join(c))
                    except: pass
                else: lines.append(it.name)
                if len(lines) > 400: break
        except: return "(Error)"
        return "\n".join(lines)

    def build(self, user_prompt: str) -> str:
        tree_str = self._get_tree()
        candidates = ["README.md", "package.json", "turbo.json", "SKILL.md", "requirements.txt", "oracle.json", "Cargo.toml", "go.mod"]
        file_content = []
        for f in candidates:
            block = self._read_file(self.root / f)
            if block: file_content.append(block)
        found_paths = re.findall(r'[\w\./-]+\.\w+', user_prompt)
        for fp in found_paths:
            p = self.root / fp
            if p.exists() and p.is_file():
                block = self._read_file(p)
                if block: file_content.append(block)
        if not file_content:
            for f in [x for x in self.root.iterdir() if x.is_file()][:5]:
                b = self._read_file(f)
                if b: file_content.append(b)
        return (
            f"## User Request\n<user_request>\n{sanitize_context(user_prompt)}\n</user_request>\n\n"
            f"## Workspace Context\n- Root: {self.root}\n- OS: {platform.system()}\n\n"
            f"## File Tree\n{tree_str}\n\n"
            f"## Key Files\n{''.join(file_content)}\n"
        )

def build_research_context(prompt: str, root: Optional[Path] = None) -> str:
    return ContextInjector(root).build(prompt)

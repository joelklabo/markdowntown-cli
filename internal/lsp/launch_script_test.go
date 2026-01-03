package lsp

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestVSCodeLaunchScriptDryRun(t *testing.T) {
	repoRoot := findRepoRoot(t)
	scriptPath := filepath.Join(repoRoot, "scripts", "lsp-vscode")

	// #nosec G204 -- test harness executes a controlled script with no side effects.
	cmd := exec.Command(scriptPath, "--dry-run")
	cmd.Dir = repoRoot
	cmd.Env = os.Environ()
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("lsp-vscode --dry-run failed: %v\nOutput: %s", err, output)
	}

	out := string(output)
	if !strings.Contains(out, "code --extensionDevelopmentPath") {
		t.Fatalf("expected code command in output, got: %s", out)
	}

	expectedExt := filepath.Join(repoRoot, "vscode-extension")
	if !strings.Contains(out, expectedExt) {
		t.Fatalf("expected extension path %s in output, got: %s", expectedExt, out)
	}

	expectedBin := filepath.Join(repoRoot, "bin", "markdowntown")
	if !strings.Contains(out, expectedBin) {
		t.Fatalf("expected binary path %s in output, got: %s", expectedBin, out)
	}
}

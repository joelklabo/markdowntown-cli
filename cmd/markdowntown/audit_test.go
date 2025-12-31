package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"markdowntown-cli/internal/audit"
)

func TestAuditJSONOutput(t *testing.T) {
	repoRoot := repoRoot(t)
	scanPath := filepath.Join(repoRoot, "testdata", "audit", "scan-basic.json")
	goldenPath := filepath.Join(repoRoot, "testdata", "golden", "audit-basic.json")

	stdout, stderr, exitCode := runAuditCLI(t, repoRoot, "audit", "--input", scanPath)
	if exitCode != 1 {
		t.Fatalf("expected exit code 1, got %d (stderr: %s)", exitCode, stderr)
	}
	if strings.TrimSpace(stderr) != "" {
		t.Fatalf("expected empty stderr, got %q", stderr)
	}

	got := normalizeOutput(t, []byte(stdout))
	want := normalizeOutput(t, mustReadFile(t, goldenPath))
	assertOutputsEqual(t, got, want)
}

func TestAuditMarkdownOutput(t *testing.T) {
	repoRoot := repoRoot(t)
	scanPath := filepath.Join(repoRoot, "testdata", "audit", "scan-basic.json")
	goldenPath := filepath.Join(repoRoot, "testdata", "golden", "audit-basic.md")

	stdout, stderr, exitCode := runAuditCLI(t, repoRoot, "audit", "--input", scanPath, "--format", "md")
	if exitCode != 1 {
		t.Fatalf("expected exit code 1, got %d (stderr: %s)", exitCode, stderr)
	}
	if strings.TrimSpace(stderr) != "" {
		t.Fatalf("expected empty stderr, got %q", stderr)
	}

	if stdout != string(mustReadFile(t, goldenPath)) {
		t.Fatalf("markdown output mismatch")
	}
}

func TestAuditIncludeScanWarnings(t *testing.T) {
	repoRoot := repoRoot(t)
	scanPath := filepath.Join(repoRoot, "testdata", "audit", "scan-basic.json")
	goldenPath := filepath.Join(repoRoot, "testdata", "golden", "audit-warnings.json")

	stdout, stderr, exitCode := runAuditCLI(t, repoRoot, "audit", "--input", scanPath, "--include-scan-warnings")
	if exitCode != 1 {
		t.Fatalf("expected exit code 1, got %d (stderr: %s)", exitCode, stderr)
	}
	if strings.TrimSpace(stderr) != "" {
		t.Fatalf("expected empty stderr, got %q", stderr)
	}

	got := normalizeOutput(t, []byte(stdout))
	want := normalizeOutput(t, mustReadFile(t, goldenPath))
	assertOutputsEqual(t, got, want)
}

func TestAuditOnlyIgnoreRules(t *testing.T) {
	repoRoot := repoRoot(t)
	scanPath := filepath.Join(repoRoot, "testdata", "audit", "scan-basic.json")

	stdout, stderr, exitCode := runAuditCLI(t, repoRoot, "audit", "--input", scanPath, "--only", "MD004", "--ignore-rule", "MD004")
	if exitCode != 0 {
		t.Fatalf("expected exit code 0, got %d (stderr: %s)", exitCode, stderr)
	}
	if strings.TrimSpace(stderr) != "" {
		t.Fatalf("expected empty stderr, got %q", stderr)
	}

	got := normalizeOutput(t, []byte(stdout))
	if len(got.Issues) != 0 {
		t.Fatalf("expected no issues, got %d", len(got.Issues))
	}
	if got.Summary.IssueCounts != (audit.SeverityCounts{}) {
		t.Fatalf("expected zero summary counts, got %+v", got.Summary.IssueCounts)
	}
}

func TestAuditExcludePaths(t *testing.T) {
	repoRoot := repoRoot(t)
	scanPath := filepath.Join(repoRoot, "testdata", "audit", "scan-basic.json")

	stdout, stderr, exitCode := runAuditCLI(t, repoRoot, "audit", "--input", scanPath, "--exclude", "./.cursor/*")
	if exitCode != 1 {
		t.Fatalf("expected exit code 1, got %d (stderr: %s)", exitCode, stderr)
	}
	if strings.TrimSpace(stderr) != "" {
		t.Fatalf("expected empty stderr, got %q", stderr)
	}

	got := normalizeOutput(t, []byte(stdout))
	for _, issue := range got.Issues {
		if issue.RuleID == "MD001" {
			t.Fatalf("expected conflict issue to be excluded")
		}
	}
}

func runAuditCLI(t *testing.T, repoRoot string, args ...string) (string, string, int) {
	t.Helper()

	registryPath := filepath.Join(repoRoot, "testdata", "registry", "audit.json")
	cmdArgs := append([]string{"run", "./cmd/markdowntown"}, args...)
	cmd := exec.Command("go", cmdArgs...)
	cmd.Dir = repoRoot

	homeDir := t.TempDir()
	cacheDir := t.TempDir()
	cmd.Env = append(os.Environ(),
		"MARKDOWNTOWN_REGISTRY="+registryPath,
		"HOME="+homeDir,
		"XDG_CONFIG_HOME="+filepath.Join(homeDir, ".config"),
		"GOCACHE="+cacheDir,
	)

	var stdout strings.Builder
	var stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			t.Fatalf("run audit CLI: %v", err)
		}
	}

	return stdout.String(), stderr.String(), exitCode
}

func repoRoot(t *testing.T) string {
	t.Helper()
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	return filepath.Dir(cwd)
}

func normalizeOutput(t *testing.T, data []byte) audit.Output {
	t.Helper()
	var output audit.Output
	if err := json.Unmarshal(data, &output); err != nil {
		t.Fatalf("parse output: %v", err)
	}
	output.Audit.AuditStartedAt = 0
	output.Audit.GeneratedAt = 0
	return output
}

func mustReadFile(t *testing.T, path string) []byte {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read file: %v", err)
	}
	return data
}

func assertOutputsEqual(t *testing.T, got audit.Output, want audit.Output) {
	t.Helper()
	if reflect.DeepEqual(got, want) {
		return
	}
	gotJSON, _ := json.MarshalIndent(got, "", "  ")
	wantJSON, _ := json.MarshalIndent(want, "", "  ")
	t.Fatalf("audit output mismatch\n--- got ---\n%s\n--- want ---\n%s", string(gotJSON), string(wantJSON))
}

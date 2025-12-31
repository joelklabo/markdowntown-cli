package main

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"markdowntown-cli/internal/audit"
	"markdowntown-cli/internal/scan"
	"markdowntown-cli/internal/version"
)

func TestAuditGoldenJSON(t *testing.T) {
	root := repoRoot(t)
	repo := setupAuditRepo(t, root)
	registryPath := filepath.Join(root, "data", "ai-config-patterns.json")

	stdout, stderr, exitCode := runAuditCLIWithRegistry(t, root, registryPath, nil, "audit", "--repo", repo, "--repo-only", "--format", "json", "--compact")
	if exitCode != 1 {
		t.Fatalf("expected exit code 1, got %d (stderr: %s)", exitCode, stderr)
	}
	if strings.TrimSpace(stderr) != "" {
		t.Fatalf("expected empty stderr, got %q", stderr)
	}

	var output audit.Output
	if err := json.Unmarshal([]byte(stdout), &output); err != nil {
		t.Fatalf("unmarshal output: %v", err)
	}
	output.Audit.AuditStartedAt = 0
	output.Audit.GeneratedAt = 0
	output.SourceScan.RepoRoot = "<repoRoot>"
	output.SourceScan.ScanStartedAt = 0
	output.SourceScan.GeneratedAt = 0
	output.SourceScan.Scans = []scan.Root{{Scope: "repo", Root: "<repoRoot>", Exists: true}}
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	if err := enc.Encode(output); err != nil {
		t.Fatalf("encode normalized: %v", err)
	}
	normalized := bytes.TrimSpace(buf.Bytes())

	golden := readFile(t, filepath.Join(root, "testdata", "golden", "audit.json"))
	if string(normalized) != string(golden) {
		t.Fatalf("audit.json mismatch\nexpected: %s\nactual: %s", strings.TrimSpace(string(golden)), strings.TrimSpace(string(normalized)))
	}
}

func TestAuditGoldenMarkdown(t *testing.T) {
	root := repoRoot(t)
	repo := setupAuditRepo(t, root)
	registryPath := filepath.Join(root, "data", "ai-config-patterns.json")

	stdout, stderr, exitCode := runAuditCLIWithRegistry(t, root, registryPath, nil, "audit", "--repo", repo, "--repo-only", "--format", "md")
	if exitCode != 1 {
		t.Fatalf("expected exit code 1, got %d (stderr: %s)", exitCode, stderr)
	}
	if strings.TrimSpace(stderr) != "" {
		t.Fatalf("expected empty stderr, got %q", stderr)
	}

	golden := readFile(t, filepath.Join(root, "testdata", "golden", "audit.md"))
	if strings.TrimSpace(stdout) != strings.TrimSpace(string(golden)) {
		t.Fatalf("audit.md mismatch\nexpected: %s\nactual: %s", strings.TrimSpace(string(golden)), strings.TrimSpace(stdout))
	}
}

func TestAuditStdinInput(t *testing.T) {
	root := repoRoot(t)
	input := scan.Output{
		SchemaVersion:   version.SchemaVersion,
		RegistryVersion: "1.0",
		ToolVersion:     "0.1.0",
		ScanStartedAt:   1,
		GeneratedAt:     2,
		RepoRoot:        "/repo",
		Scans:           []scan.Root{{Scope: "repo", Root: "/repo", Exists: true}},
	}
	payload, err := json.Marshal(input)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	registryPath := filepath.Join(root, "data", "ai-config-patterns.json")
	stdout, stderr, exitCode := runAuditCLIWithRegistry(t, root, registryPath, payload, "audit", "--input", "-", "--format", "json", "--compact")
	if exitCode != 0 {
		t.Fatalf("expected exit code 0, got %d (stderr: %s)", exitCode, stderr)
	}
	if strings.TrimSpace(stderr) != "" {
		t.Fatalf("expected empty stderr, got %q", stderr)
	}
	if !strings.Contains(stdout, "\"schemaVersion\"") {
		t.Fatalf("expected schemaVersion in output")
	}
}

func TestAuditInvalidInput(t *testing.T) {
	root := repoRoot(t)
	registryPath := filepath.Join(root, "data", "ai-config-patterns.json")
	_, stderr, exitCode := runAuditCLIWithRegistry(t, root, registryPath, []byte("not-json"), "audit", "--input", "-", "--format", "json")
	if exitCode != 1 {
		t.Fatalf("expected exit code 1 from go run, got %d", exitCode)
	}
	if !strings.Contains(stderr, "invalid character") {
		t.Fatalf("expected JSON parse error in stderr, got %q", stderr)
	}
}

func setupAuditRepo(t *testing.T, root string) string {
	repo := t.TempDir()
	src := filepath.Join(root, "testdata", "repos", "audit")
	copyDir(t, src, repo)

	cmd := exec.Command("git", "init")
	cmd.Dir = repo
	if err := cmd.Run(); err != nil {
		t.Fatalf("git init: %v", err)
	}
	return repo
}

func runAuditCLIWithRegistry(t *testing.T, repoRoot string, registryPath string, stdinPayload []byte, args ...string) (string, string, int) {
	t.Helper()

	cmdArgs := append([]string{"run", "./cmd/markdowntown"}, args...)
	cmd := exec.Command("go", cmdArgs...)
	cmd.Dir = repoRoot

	homeDir := t.TempDir()
	cacheDir, modCacheDir := testGoCaches(t)
	cmd.Env = append(os.Environ(),
		"MARKDOWNTOWN_REGISTRY="+registryPath,
		"HOME="+homeDir,
		"XDG_CONFIG_HOME="+filepath.Join(homeDir, ".config"),
		"GOCACHE="+cacheDir,
		"GOMODCACHE="+modCacheDir,
		"GOFLAGS=-modcacherw",
	)

	if stdinPayload != nil {
		cmd.Stdin = bytes.NewReader(stdinPayload)
	}

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
	return stdout.String(), stripGoToolNoise(stderr.String()), exitCode
}

func copyDir(t *testing.T, src, dst string) {
	entries, err := os.ReadDir(src)
	if err != nil {
		t.Fatalf("read dir: %v", err)
	}
	if err := os.MkdirAll(dst, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())
		if entry.IsDir() {
			copyDir(t, srcPath, dstPath)
			continue
		}
		data, err := os.ReadFile(srcPath)
		if err != nil {
			t.Fatalf("read file: %v", err)
		}
		if err := os.WriteFile(dstPath, data, 0o644); err != nil {
			t.Fatalf("write file: %v", err)
		}
	}
}

func readFile(t *testing.T, path string) []byte {
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read file: %v", err)
	}
	return bytes.TrimSpace(data)
}

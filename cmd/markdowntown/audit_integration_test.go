package main

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"markdowntown-cli/internal/audit"
	"markdowntown-cli/internal/scan"
)

func TestAuditGoldenJSON(t *testing.T) {
	root := repoRoot(t)
	repo := setupAuditRepo(t, root)
	t.Setenv("MARKDOWNTOWN_REGISTRY", filepath.Join(root, "data", "ai-config-patterns.json"))

	code, out := runAuditCapture(t, []string{"--repo", repo, "--repo-only", "--format", "json", "--compact"})
	if code != 1 {
		t.Fatalf("expected exit code 1, got %d", code)
	}

	var output audit.Output
	if err := json.Unmarshal([]byte(out), &output); err != nil {
		t.Fatalf("unmarshal output: %v", err)
	}
	output.AuditStartedAt = 0
	output.GeneratedAt = 0
	output.Input.RepoRoot = "<repoRoot>"
	output.Input.ScanStartedAt = 0
	output.Input.ScanGeneratedAt = 0
	output.Input.Scans = []string{"<repoRoot>"}
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
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
	t.Setenv("MARKDOWNTOWN_REGISTRY", filepath.Join(root, "data", "ai-config-patterns.json"))

	code, out := runAuditCapture(t, []string{"--repo", repo, "--repo-only", "--format", "md"})
	if code != 1 {
		t.Fatalf("expected exit code 1, got %d", code)
	}

	golden := readFile(t, filepath.Join(root, "testdata", "golden", "audit.md"))
	if strings.TrimSpace(out) != strings.TrimSpace(string(golden)) {
		t.Fatalf("audit.md mismatch\nexpected: %s\nactual: %s", strings.TrimSpace(string(golden)), strings.TrimSpace(out))
	}
}

func TestAuditStdinInput(t *testing.T) {
	input := scan.Output{
		SchemaVersion:   "1.0",
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

	code, out := runAuditWithStdin(t, []string{"--input", "-", "--format", "json", "--compact"}, payload)
	if code != 0 {
		t.Fatalf("expected exit code 0, got %d", code)
	}
	if !strings.Contains(out, "\"schemaVersion\"") {
		t.Fatalf("expected schemaVersion in output")
	}
}

func TestAuditInvalidInput(t *testing.T) {
	code, err := runAuditErrorWithStdin(t, []string{"--input", "-", "--format", "json"}, []byte("not-json"))
	if err == nil {
		t.Fatalf("expected error")
	}
	if code != 2 {
		t.Fatalf("expected exit code 2, got %d", code)
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

func runAuditCapture(t *testing.T, args []string) (int, string) {
	code, out, err := runAuditWithStdout(t, args, nil)
	if err != nil {
		t.Fatalf("runAudit error: %v", err)
	}
	return code, out
}

func runAuditWithStdin(t *testing.T, args []string, payload []byte) (int, string) {
	code, out, err := runAuditWithStdout(t, args, payload)
	if err != nil {
		t.Fatalf("runAudit error: %v", err)
	}
	return code, out
}

func runAuditErrorWithStdin(t *testing.T, args []string, payload []byte) (int, error) {
	code, _, err := runAuditWithStdout(t, args, payload)
	return code, err
}

func runAuditWithStdout(t *testing.T, args []string, stdinPayload []byte) (int, string, error) {
	stdinReader, stdinWriter, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe stdin: %v", err)
	}
	stdoutReader, stdoutWriter, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe stdout: %v", err)
	}

	oldStdin := os.Stdin
	oldStdout := os.Stdout
	os.Stdin = stdinReader
	os.Stdout = stdoutWriter
	defer func() {
		os.Stdin = oldStdin
		os.Stdout = oldStdout
	}()

	if stdinPayload != nil {
		go func() {
			_, _ = stdinWriter.Write(stdinPayload)
			_ = stdinWriter.Close()
		}()
	} else {
		_ = stdinWriter.Close()
	}

	code, err := runAudit(args)
	_ = stdoutWriter.Close()

	outBytes, readErr := io.ReadAll(stdoutReader)
	if readErr != nil {
		t.Fatalf("read stdout: %v", readErr)
	}
	return code, strings.TrimSpace(string(outBytes)), err
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

func repoRoot(t *testing.T) string {
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	for {
		candidate := filepath.Join(cwd, "data", "ai-config-patterns.json")
		if _, err := os.Stat(candidate); err == nil {
			return cwd
		}
		parent := filepath.Dir(cwd)
		if parent == cwd {
			break
		}
		cwd = parent
	}
	t.Fatalf("repo root not found")
	return ""
}

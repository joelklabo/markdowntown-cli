package main

import (
	"bytes"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"testing"
)

func TestSuggestCLIGoldenJSON(t *testing.T) {
	var out bytes.Buffer
	if err := runSuggestWithIO(&out, io.Discard, []string{"--offline", "--format", "json"}); err != nil {
		t.Fatalf("runSuggest failed: %v", err)
	}

	got := normalizeGeneratedAt(out.String())
	expected := readGolden(t, "suggest.json")
	if strings.TrimSpace(got) != strings.TrimSpace(expected) {
		t.Fatalf("suggest json mismatch\nexpected:\n%s\n\nactual:\n%s", expected, got)
	}
}

func TestSuggestCLIGoldenMarkdown(t *testing.T) {
	var out bytes.Buffer
	if err := runSuggestWithIO(&out, io.Discard, []string{"--offline", "--format", "md"}); err != nil {
		t.Fatalf("runSuggest failed: %v", err)
	}

	expected := readGolden(t, "suggest.md")
	if strings.TrimSpace(out.String()) != strings.TrimSpace(expected) {
		t.Fatalf("suggest markdown mismatch\nexpected:\n%s\n\nactual:\n%s", expected, out.String())
	}
}

func TestResolveCLIGoldenJSON(t *testing.T) {
	repoRoot := t.TempDir()
	initGitRepo(t, repoRoot)
	writeFile(t, filepath.Join(repoRoot, "AGENTS.md"), "root")

	codexHome := filepath.Join(repoRoot, ".codex")
	if err := os.MkdirAll(codexHome, 0o755); err != nil {
		t.Fatalf("mkdir codex home: %v", err)
	}
	os.Setenv("CODEX_HOME", codexHome)

	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	defer os.Chdir(cwd)
	if err := os.Chdir(repoRoot); err != nil {
		t.Fatalf("chdir: %v", err)
	}

	var out bytes.Buffer
	if err := runResolveWithIO(&out, io.Discard, []string{"--client", "codex", "--format", "json", "--repo", repoRoot}); err != nil {
		t.Fatalf("runResolve failed: %v", err)
	}

	normalized := normalizeGeneratedAt(out.String())
	normalized = strings.ReplaceAll(normalized, "/private"+repoRoot, "<REPO>")
	normalized = strings.ReplaceAll(normalized, repoRoot, "<REPO>")
	expected := readGolden(t, "resolve.json")
	if strings.TrimSpace(normalized) != strings.TrimSpace(expected) {
		t.Fatalf("resolve json mismatch\nexpected:\n%s\n\nactual:\n%s", expected, normalized)
	}
}

func TestAuditCLIOffline(t *testing.T) {
	var out bytes.Buffer
	if err := runAuditWithIO(&out, io.Discard, []string{"--offline", "--format", "json"}); err != nil {
		t.Fatalf("runAudit failed: %v", err)
	}
	if !strings.Contains(out.String(), "offline mode enabled") {
		t.Fatalf("expected offline warning in audit output")
	}
}

func TestSuggestCLIUnknownClientExitCode(t *testing.T) {
	repoRoot := repoRootFromCaller(t)
	cmd := exec.Command("go", "run", "./cmd/markdowntown", "suggest", "--client", "nope")
	cmd.Dir = repoRoot

	var stderr bytes.Buffer
	cmd.Stdout = io.Discard
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err == nil {
		t.Fatalf("expected non-zero exit code")
	}
	exitErr, ok := err.(*exec.ExitError)
	if !ok {
		t.Fatalf("expected exit error, got %T: %v", err, err)
	}
	if exitErr.ExitCode() == 0 {
		t.Fatalf("expected non-zero exit code, got 0")
	}
	if !strings.Contains(stderr.String(), "unknown client") {
		t.Fatalf("expected unknown client error, got: %s", stderr.String())
	}
}

func normalizeGeneratedAt(input string) string {
	re := regexp.MustCompile(`"generatedAt"\s*:\s*\d+`)
	return re.ReplaceAllString(input, "\"generatedAt\": 0")
}

func repoRootFromCaller(t *testing.T) string {
	t.Helper()
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatalf("runtime caller failed")
	}
	base := filepath.Dir(filename)
	return filepath.Clean(filepath.Join(base, "..", ".."))
}

func readGolden(t *testing.T, name string) string {
	t.Helper()
	repoRoot := repoRootFromCaller(t)
	path := filepath.Join(repoRoot, "testdata", "golden", name)
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read golden %s: %v", name, err)
	}
	return string(data)
}

func initGitRepo(t *testing.T, dir string) {
	t.Helper()
	cmd := exec.Command("git", "init")
	cmd.Dir = dir
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git init failed: %v: %s", err, string(output))
	}
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write file: %v", err)
	}
}

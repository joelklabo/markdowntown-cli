package main

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"testing"

	"markdowntown-cli/internal/instructions"
	"markdowntown-cli/internal/suggest"
)

func TestSuggestCLIGoldenJSON(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("golden file tests have path format differences on Windows")
	}
	setSuggestEnv(t)
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
	if runtime.GOOS == "windows" {
		t.Skip("golden file tests have path format differences on Windows")
	}
	setSuggestEnv(t)
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
	if runtime.GOOS == "windows" {
		t.Skip("golden file comparison fails on Windows due to path format differences")
	}
	repoRoot := t.TempDir()
	initGitRepo(t, repoRoot)
	writeFile(t, filepath.Join(repoRoot, "AGENTS.md"), "root")

	codexHome := filepath.Join(repoRoot, ".codex")
	if err := os.MkdirAll(codexHome, 0o750); err != nil {
		t.Fatalf("mkdir codex home: %v", err)
	}
	t.Setenv("CODEX_HOME", codexHome)

	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	t.Cleanup(func() {
		if err := os.Chdir(cwd); err != nil {
			t.Fatalf("restore cwd: %v", err)
		}
	})
	if err := os.Chdir(repoRoot); err != nil {
		t.Fatalf("chdir: %v", err)
	}

	var out bytes.Buffer
	if err := runResolveWithIO(&out, io.Discard, []string{"--client", "codex", "--format", "json", "--repo", repoRoot}); err != nil {
		t.Fatalf("runResolve failed: %v", err)
	}

	normalized := normalizeResolveReport(t, repoRoot, out.String())
	expected := readGolden(t, "resolve.json")
	if strings.TrimSpace(normalized) != strings.TrimSpace(expected) {
		t.Fatalf("resolve json mismatch\nexpected:\n%s\n\nactual:\n%s", expected, normalized)
	}
}

func TestSuggestCLIUnknownClientExitCode(t *testing.T) {
	repoRoot := repoRootFromCaller(t)
	// #nosec G204 -- test harness controls command arguments.
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

func setSuggestEnv(t *testing.T) {
	t.Helper()
	repoRoot := repoRootFromCaller(t)
	t.Setenv("MARKDOWNTOWN_SOURCES", filepath.Join(repoRoot, "testdata", "suggest", "doc-sources.json"))
	t.Setenv("XDG_DATA_HOME", t.TempDir())
	t.Setenv("XDG_CACHE_HOME", t.TempDir())
}

func normalizeGeneratedAt(input string) string {
	re := regexp.MustCompile(`"generatedAt"\s*:\s*\d+`)
	return re.ReplaceAllString(input, "\"generatedAt\": 0")
}

func normalizeResolveReport(t *testing.T, repoRoot, output string) string {
	t.Helper()
	var report suggest.ResolveReport
	if err := json.Unmarshal([]byte(output), &report); err != nil {
		t.Fatalf("unmarshal resolve output: %v", err)
	}
	report.GeneratedAt = 0
	normalizeResolutionPaths(&report.Resolution, repoRoot)

	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)
	if err := enc.Encode(report); err != nil {
		t.Fatalf("marshal resolve output: %v", err)
	}
	return strings.TrimSpace(buf.String())
}

func normalizeResolutionPaths(resolution *instructions.Resolution, repoRoot string) {
	if resolution == nil {
		return
	}
	resolution.RepoRoot = normalizeRepoPath(resolution.RepoRoot, repoRoot)
	resolution.Cwd = normalizeRepoPath(resolution.Cwd, repoRoot)
	resolution.TargetPath = normalizeRepoPath(resolution.TargetPath, repoRoot)
	resolution.CodexHome = normalizeRepoPath(resolution.CodexHome, repoRoot)
	resolution.ConfigPath = normalizeRepoPath(resolution.ConfigPath, repoRoot)

	for i := range resolution.Applied {
		resolution.Applied[i].Path = normalizeRepoPath(resolution.Applied[i].Path, repoRoot)
		resolution.Applied[i].Dir = normalizeRepoPath(resolution.Applied[i].Dir, repoRoot)
	}
}

func normalizeRepoPath(path, repoRoot string) string {
	if path == "" || repoRoot == "" {
		return path
	}
	rel, ok := relativeFromRoot(repoRoot, path)
	if !ok {
		return path
	}
	if rel == "." {
		return "<REPO>"
	}
	return filepath.ToSlash(filepath.Join("<REPO>", rel))
}

func relativeFromRoot(root, target string) (string, bool) {
	rootClean := filepath.Clean(root)
	targetClean := filepath.Clean(target)

	rel, err := filepath.Rel(rootClean, targetClean)
	if err == nil {
		if rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))) {
			return rel, true
		}
	}

	return relativeFromFS(rootClean, targetClean)
}

func relativeFromFS(root, target string) (string, bool) {
	rootInfo, err := os.Stat(root)
	if err != nil {
		return "", false
	}

	current := target
	var parts []string
	for {
		info, err := os.Stat(current)
		if err != nil {
			return "", false
		}
		if os.SameFile(rootInfo, info) {
			if len(parts) == 0 {
				return ".", true
			}
			for i, j := 0, len(parts)-1; i < j; i, j = i+1, j-1 {
				parts[i], parts[j] = parts[j], parts[i]
			}
			return filepath.Join(parts...), true
		}

		parent := filepath.Dir(current)
		if parent == current {
			return "", false
		}
		parts = append(parts, filepath.Base(current))
		current = parent
	}
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
	// #nosec G304 -- test helper reads controlled fixture paths.
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
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}
}

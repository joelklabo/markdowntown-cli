package scan

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"runtime"
	"strconv"
	"strings"
	"testing"
	"time"
)

var updateGolden = flag.Bool("update-golden", false, "update golden fixtures")

func skipGlobalIntegrationOnWindows(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("global scope is not supported on Windows")
	}
}

func TestScanIntegrationGolden(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}

	repoRoot := copyFixture(t, "integration")
	execGit(t, repoRoot, "init")

	userRoot := t.TempDir()
	writeTestFile(t, filepath.Join(userRoot, "AGENTS.md"), "User instructions")
	writeTestFile(t, filepath.Join(userRoot, ".codex", "prompts", "refactor.md"), "Refactor prompt")
	writeTestFile(t, filepath.Join(userRoot, ".codex", "skills", "review", "SKILL.md"), "Review skill")

	stdinPath := filepath.Join(repoRoot, "stdin", "unmatched.txt")
	registry := integrationRegistry()

	result, err := Scan(Options{
		RepoRoot:   repoRoot,
		UserRoots:  []string{userRoot},
		StdinPaths: []string{stdinPath},
		Registry:   registry,
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	result, err = ApplyGitignore(result, repoRoot)
	if err != nil {
		t.Fatalf("gitignore: %v", err)
	}

	output := BuildOutput(result, OutputOptions{
		SchemaVersion:   "test",
		RegistryVersion: registry.Version,
		ToolVersion:     "test",
		RepoRoot:        repoRoot,
		ScanStartedAt:   0,
		GeneratedAt:     0,
		Timing:          Timing{},
	})

	normalized := normalizeOutput(output, repoRoot, userRoot)
	goldenPath := filepath.Join("..", "..", "testdata", "golden", "scan.json")

	actual := mustMarshal(t, normalized)
	if *updateGolden {
		writeGolden(t, goldenPath, actual)
		return
	}

	// #nosec G304 -- golden path is test-controlled.
	expected, err := os.ReadFile(goldenPath)
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}

	if !bytes.Equal(actual, expected) {
		t.Fatalf("golden mismatch (run with -update-golden to refresh)\nexpected:\n%s\nactual:\n%s", expected, actual)
	}
}

func TestScanIntegrationGlobalScope(t *testing.T) {
	skipGlobalIntegrationOnWindows(t)

	repoRoot := t.TempDir()
	writeTestFile(t, filepath.Join(repoRoot, "repo.md"), "repo")

	globalRoot := copyFixture(t, "global-scope")

	result, err := Scan(Options{
		RepoRoot:      repoRoot,
		IncludeGlobal: true,
		GlobalRoots:   []string{globalRoot},
		Registry:      globalScopeRegistry(),
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	output := BuildOutput(result, OutputOptions{
		SchemaVersion:   "test",
		RegistryVersion: "1",
		ToolVersion:     "test",
		RepoRoot:        repoRoot,
	})

	foundGlobal := false
	for _, scan := range output.Scans {
		if scan.Scope == ScopeGlobal && filepath.Clean(scan.Root) == filepath.Clean(globalRoot) {
			foundGlobal = true
			break
		}
	}
	if !foundGlobal {
		t.Fatalf("expected global scan root %s", globalRoot)
	}

	if !hasEntryWithPath(output.Configs, filepath.Join(globalRoot, "global.md")) {
		t.Fatalf("expected global config entry in output")
	}
}

func TestScanIntegrationParallelWorkers(t *testing.T) {
	skipGlobalIntegrationOnWindows(t)

	repoRoot := t.TempDir()
	writeTestFile(t, filepath.Join(repoRoot, "repo.md"), "repo")

	globalRoot := copyFixture(t, "global-scope")
	registry := Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "global-mixed",
				ToolID:       "global-tool",
				ToolName:     "Global Tool",
				Kind:         "config",
				Scope:        ScopeGlobal,
				Paths:        []string{"global.md", "small.txt", "medium.txt", "large.txt"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
		},
	}

	baseline := scanOutputForGlobalWorkers(t, repoRoot, globalRoot, registry, 1)
	got := scanOutputForGlobalWorkers(t, repoRoot, globalRoot, registry, 4)
	if !reflect.DeepEqual(baseline, got) {
		t.Fatalf("parallel scan mismatch\nexpected:\n%s\nactual:\n%s", mustMarshal(t, baseline), mustMarshal(t, got))
	}
}

func TestScanIntegrationGlobalSymlinkEscape(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink permissions vary on Windows")
	}

	repoRoot := t.TempDir()
	globalRoot := copyFixture(t, "global-scope")
	externalDir := t.TempDir()
	externalPath := filepath.Join(externalDir, "escape.md")
	writeTestFile(t, externalPath, "escape")

	linkPath := filepath.Join(globalRoot, "escape-link")
	if err := os.Symlink(externalPath, linkPath); err != nil {
		if errors.Is(err, fs.ErrPermission) {
			t.Skip("symlinks not permitted")
		}
		t.Fatalf("symlink: %v", err)
	}

	registry := Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "global-escape",
				ToolID:       "global-tool",
				ToolName:     "Global Tool",
				Kind:         "config",
				Scope:        ScopeGlobal,
				Paths:        []string{"escape-link"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
		},
	}

	result, err := Scan(Options{
		RepoRoot:      repoRoot,
		IncludeGlobal: true,
		GlobalRoots:   []string{globalRoot},
		Registry:      registry,
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	output := BuildOutput(result, OutputOptions{
		SchemaVersion:   "test",
		RegistryVersion: "1",
		ToolVersion:     "test",
		RepoRoot:        repoRoot,
	})

	if !hasWarning(output.Warnings, linkPath, "SYMLINK_ESCAPE") {
		t.Fatalf("expected SYMLINK_ESCAPE warning for %s", linkPath)
	}
}

func TestScanIntegrationGlobalSymlinkMultiHopEscape(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink permissions vary on Windows")
	}

	repoRoot := t.TempDir()
	globalRoot := copyFixture(t, "global-scope")
	externalDir := t.TempDir()
	externalPath := filepath.Join(externalDir, "escape.md")
	writeTestFile(t, externalPath, "escape")

	linkTwo := filepath.Join(globalRoot, "escape-link-two")
	if err := os.Symlink(externalPath, linkTwo); err != nil {
		if errors.Is(err, fs.ErrPermission) {
			t.Skip("symlinks not permitted")
		}
		t.Fatalf("symlink: %v", err)
	}
	linkOne := filepath.Join(globalRoot, "escape-link-one")
	if err := os.Symlink(linkTwo, linkOne); err != nil {
		if errors.Is(err, fs.ErrPermission) {
			t.Skip("symlinks not permitted")
		}
		t.Fatalf("symlink: %v", err)
	}

	registry := Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "global-escape",
				ToolID:       "global-tool",
				ToolName:     "Global Tool",
				Kind:         "config",
				Scope:        ScopeGlobal,
				Paths:        []string{"escape-link-one"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
		},
	}

	result, err := Scan(Options{
		RepoRoot:      repoRoot,
		IncludeGlobal: true,
		GlobalRoots:   []string{globalRoot},
		Registry:      registry,
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	output := BuildOutput(result, OutputOptions{
		SchemaVersion:   "test",
		RegistryVersion: "1",
		ToolVersion:     "test",
		RepoRoot:        repoRoot,
	})

	if !hasWarning(output.Warnings, linkOne, "SYMLINK_ESCAPE") {
		t.Fatalf("expected SYMLINK_ESCAPE warning for %s", linkOne)
	}
}

func scanOutputForGlobalWorkers(t *testing.T, repoRoot string, globalRoot string, registry Registry, workers int) Output {
	t.Helper()
	result, err := Scan(Options{
		RepoRoot:       repoRoot,
		IncludeGlobal:  true,
		GlobalRoots:    []string{globalRoot},
		Registry:       registry,
		IncludeContent: true,
		ScanWorkers:    workers,
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	output := BuildOutput(result, OutputOptions{
		SchemaVersion:   "test",
		RegistryVersion: registry.Version,
		ToolVersion:     "test",
		RepoRoot:        repoRoot,
	})
	for i := range output.Configs {
		output.Configs[i].Mtime = 0
	}
	return output
}

func TestScanIntegrationGlobalGuardrails(t *testing.T) {
	skipGlobalIntegrationOnWindows(t)

	repoRoot := t.TempDir()
	globalRoot := t.TempDir()
	writeTestFile(t, filepath.Join(globalRoot, "a.md"), "a")
	writeTestFile(t, filepath.Join(globalRoot, "b.md"), "b")

	registry := Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "global-config",
				ToolID:       "global-tool",
				ToolName:     "Global Tool",
				Kind:         "config",
				Scope:        ScopeGlobal,
				Paths:        []string{"*.md"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
		},
	}

	result, err := Scan(Options{
		RepoRoot:       repoRoot,
		IncludeGlobal:  true,
		GlobalRoots:    []string{globalRoot},
		GlobalMaxFiles: 1,
		Registry:       registry,
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	output := BuildOutput(result, OutputOptions{
		SchemaVersion:   "test",
		RegistryVersion: "1",
		ToolVersion:     "test",
		RepoRoot:        repoRoot,
	})

	if hasEntryWithPath(output.Configs, filepath.Join(globalRoot, "b.md")) {
		t.Fatalf("expected b.md to be skipped due to max files guardrail")
	}
	if !hasWarning(output.Warnings, filepath.Join(globalRoot, "b.md"), "GLOBAL_MAX_FILES") {
		t.Fatalf("expected GLOBAL_MAX_FILES warning")
	}
}

func integrationRegistry() Registry {
	return Registry{
		Version: "test",
		Patterns: []Pattern{
			{
				ID:           "cursor-file",
				ToolID:       "cursor",
				ToolName:     "Cursor",
				Kind:         "rules",
				Scope:        "repo",
				Paths:        []string{".cursorrules"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
			{
				ID:           "cursor-dir",
				ToolID:       "cursor",
				ToolName:     "Cursor",
				Kind:         "rules",
				Scope:        "repo",
				Paths:        []string{".cursor/rules/**/*"},
				Type:         "glob",
				LoadBehavior: "directory-glob",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
			{
				ID:           "shared-alpha",
				ToolID:       "alpha",
				ToolName:     "Alpha",
				Kind:         "config",
				Scope:        "repo",
				Paths:        []string{"shared/config.json"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
			{
				ID:           "shared-beta",
				ToolID:       "beta",
				ToolName:     "Beta",
				Kind:         "config",
				Scope:        "repo",
				Paths:        []string{"shared/config.json"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
			{
				ID:           "ignored",
				ToolID:       "ignored-tool",
				ToolName:     "Ignored",
				Kind:         "config",
				Scope:        "repo",
				Paths:        []string{"ignored.txt"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
			{
				ID:           "user-agents",
				ToolID:       "codex",
				ToolName:     "Codex",
				Kind:         "instructions",
				Scope:        "user",
				Paths:        []string{"AGENTS.md"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
			{
				ID:           "codex-repo-agents",
				ToolID:       "codex",
				ToolName:     "Codex",
				Kind:         "instructions",
				Scope:        "repo",
				Paths:        []string{"AGENTS.md"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
			{
				ID:           "codex-repo-agents-override",
				ToolID:       "codex",
				ToolName:     "Codex",
				Kind:         "instructions",
				Scope:        "repo",
				Paths:        []string{"AGENTS.override.md"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
			{
				ID:           "copilot-instructions",
				ToolID:       "github-copilot",
				ToolName:     "GitHub Copilot",
				Kind:         "instructions",
				Scope:        "repo",
				Paths:        []string{".github/copilot-instructions.md"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
			{
				ID:           "claude-memory",
				ToolID:       "claude-code",
				ToolName:     "Claude Code",
				Kind:         "instructions",
				Scope:        "repo",
				Paths:        []string{"CLAUDE.md"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
			{
				ID:           "claude-rules",
				ToolID:       "claude-code",
				ToolName:     "Claude Code",
				Kind:         "rules",
				Scope:        "repo",
				Paths:        []string{".claude/rules/*.md"},
				Type:         "glob",
				LoadBehavior: "directory-glob",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
			{
				ID:           "gemini-md",
				ToolID:       "gemini-cli",
				ToolName:     "Gemini CLI",
				Kind:         "instructions",
				Scope:        "repo",
				Paths:        []string{"GEMINI.md"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
			{
				ID:           "codex-prompts-user",
				ToolID:       "codex",
				ToolName:     "Codex",
				Kind:         "prompts",
				Scope:        "user",
				Paths:        []string{".codex/prompts/*.md"},
				Type:         "glob",
				LoadBehavior: "directory-glob",
				Application:  "selected",
				Docs:         []string{"https://example.com"},
			},
			{
				ID:           "codex-skills-user",
				ToolID:       "codex",
				ToolName:     "Codex",
				Kind:         "skills",
				Scope:        "user",
				Paths:        []string{".codex/skills/**/SKILL.md"},
				Type:         "glob",
				LoadBehavior: "directory-glob",
				Application:  "invoked",
				Docs:         []string{"https://example.com"},
			},
		},
	}
}

func normalizeOutput(output Output, repoRoot string, userRoot string) Output {
	output.RepoRoot = "<repo>"
	output.ScanStartedAt = 0
	output.GeneratedAt = 0
	output.Timing = Timing{}

	for i := range output.Scans {
		switch output.Scans[i].Scope {
		case "repo":
			output.Scans[i].Root = "<repo>"
		case "user":
			output.Scans[i].Root = "<user>"
		}
	}

	for i := range output.Configs {
		output.Configs[i].Path = normalizePath(output.Configs[i].Path, repoRoot, userRoot)
		output.Configs[i].Mtime = 0
	}

	for i := range output.Warnings {
		output.Warnings[i].Path = normalizePath(output.Warnings[i].Path, repoRoot, userRoot)
	}

	return output
}

func normalizePath(path string, repoRoot string, userRoot string) string {
	normalized := filepath.ToSlash(path)
	repoRoot = filepath.ToSlash(repoRoot)
	userRoot = filepath.ToSlash(userRoot)

	if strings.HasPrefix(normalized, repoRoot) {
		return strings.Replace(normalized, repoRoot, "<repo>", 1)
	}
	if strings.HasPrefix(normalized, userRoot) {
		return strings.Replace(normalized, userRoot, "<user>", 1)
	}
	return normalized
}

func execGit(t *testing.T, dir string, args ...string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), scaledTestTimeout(t, 5*time.Second))
	t.Cleanup(cancel)
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %s: %v\n%s", strings.Join(args, " "), err, string(out))
	}
}

func writeTestFile(t *testing.T, path string, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}
}

func mustMarshal(t *testing.T, output Output) []byte {
	t.Helper()
	data, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return append(data, '\n')
}

func writeGolden(t *testing.T, path string, data []byte) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatalf("mkdir golden: %v", err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatalf("write golden: %v", err)
	}
}

func scaledTestTimeout(t *testing.T, base time.Duration) time.Duration { //nolint:unparam
	t.Helper()
	if raw := os.Getenv("MARKDOWNTOWN_TEST_TIMEOUT_SCALE"); raw != "" {
		if scale, err := strconv.ParseFloat(raw, 64); err == nil && scale > 0 {
			return time.Duration(float64(base) * scale)
		}
	}
	return base
}

package scan

import (
	"bytes"
	"encoding/json"
	"flag"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

var updateGolden = flag.Bool("update-golden", false, "update golden fixtures")

func TestScanIntegrationGolden(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}

	repoRoot := copyFixture(t, "integration")
	execGit(t, repoRoot, "init")

	userRoot := t.TempDir()
	writeTestFile(t, filepath.Join(userRoot, "AGENTS.md"), "User instructions")

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
	cmd := exec.Command("git", args...)
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

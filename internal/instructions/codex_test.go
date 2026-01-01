package instructions

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCodexAdapterResolveOrder(t *testing.T) {
	repo := t.TempDir()
	cwd := filepath.Join(repo, "service")
	if err := os.MkdirAll(cwd, 0o750); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	codexHome := filepath.Join(t.TempDir(), "codex")
	if err := os.MkdirAll(codexHome, 0o750); err != nil {
		t.Fatalf("mkdir codex home: %v", err)
	}
	t.Setenv("CODEX_HOME", codexHome)

	writeFile(t, filepath.Join(codexHome, codexAgentsFilename), "user")
	writeFile(t, filepath.Join(codexHome, codexConfigFilename), "project_doc_fallback_filenames = [\"INSTRUCTIONS.md\"]\n")

	writeFile(t, filepath.Join(repo, codexAgentsOverrideFilename), "root override")
	writeFile(t, filepath.Join(repo, codexAgentsFilename), "root primary")
	writeFile(t, filepath.Join(cwd, "INSTRUCTIONS.md"), "service instructions")

	adapter := CodexAdapter{}
	res, err := adapter.Resolve(ResolveOptions{RepoRoot: repo, Cwd: cwd})
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}

	if len(res.Applied) != 3 {
		t.Fatalf("expected 3 instructions, got %d", len(res.Applied))
	}

	if res.Applied[0].Scope != ScopeUser {
		t.Fatalf("expected user scope first, got %s", res.Applied[0].Scope)
	}

	if res.Applied[1].Reason != ReasonOverride {
		t.Fatalf("expected override at repo root, got %s", res.Applied[1].Reason)
	}

	if res.Applied[2].Reason != ReasonFallback {
		t.Fatalf("expected fallback in subdir, got %s", res.Applied[2].Reason)
	}

	if res.Applied[1].Path != filepath.Join(repo, codexAgentsOverrideFilename) {
		t.Fatalf("unexpected repo root path: %s", res.Applied[1].Path)
	}

	if len(res.FallbackFilenames) != 1 || res.FallbackFilenames[0] != "INSTRUCTIONS.md" {
		t.Fatalf("unexpected fallback filenames: %v", res.FallbackFilenames)
	}
}

func TestCodexAdapterOverrideEmptyUsesPrimary(t *testing.T) {
	repo := t.TempDir()
	codexHome := filepath.Join(t.TempDir(), "codex")
	if err := os.MkdirAll(codexHome, 0o750); err != nil {
		t.Fatalf("mkdir codex home: %v", err)
	}
	t.Setenv("CODEX_HOME", codexHome)

	writeFile(t, filepath.Join(repo, codexAgentsOverrideFilename), "")
	writeFile(t, filepath.Join(repo, codexAgentsFilename), "root primary")

	adapter := CodexAdapter{}
	res, err := adapter.Resolve(ResolveOptions{RepoRoot: repo, Cwd: repo})
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}

	if len(res.Applied) != 1 {
		t.Fatalf("expected 1 instruction, got %d", len(res.Applied))
	}

	if res.Applied[0].Reason != ReasonPrimary {
		t.Fatalf("expected primary when override empty, got %s", res.Applied[0].Reason)
	}
}

func TestCodexAdapterSizeLimit(t *testing.T) {
	repo := t.TempDir()
	codexHome := filepath.Join(t.TempDir(), "codex")
	if err := os.MkdirAll(codexHome, 0o750); err != nil {
		t.Fatalf("mkdir codex home: %v", err)
	}
	writeFile(t, filepath.Join(codexHome, codexConfigFilename), "project_doc_max_bytes = 5\n")
	writeFile(t, filepath.Join(repo, codexAgentsFilename), "1234567890")
	writeFile(t, filepath.Join(repo, codexAgentsOverrideFilename), "")

	t.Setenv("CODEX_HOME", codexHome)

	adapter := CodexAdapter{}
	res, err := adapter.Resolve(ResolveOptions{RepoRoot: repo, Cwd: repo})
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}

	if len(res.Applied) != 1 {
		t.Fatalf("expected 1 instruction, got %d", len(res.Applied))
	}

	instruction := res.Applied[0]
	if !instruction.Truncated {
		t.Fatalf("expected truncation")
	}
	if instruction.IncludedBytes != 5 {
		t.Fatalf("expected included bytes 5, got %d", instruction.IncludedBytes)
	}

	if len(res.SizeLimits) != 1 || res.SizeLimits[0].Source != "config" {
		t.Fatalf("expected size limit from config, got %v", res.SizeLimits)
	}
}

func TestResolveCodexHome(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("CODEX_HOME", tmp)
	home, err := resolveCodexHome()
	if err != nil {
		t.Fatalf("resolveCodexHome: %v", err)
	}
	if home != tmp {
		t.Fatalf("expected %s, got %s", tmp, home)
	}

	t.Setenv("CODEX_HOME", "")
	home, err = resolveCodexHome()
	if err != nil {
		t.Fatalf("resolveCodexHome default: %v", err)
	}
	if !strings.HasSuffix(home, ".codex") {
		t.Fatalf("expected .codex suffix, got %s", home)
	}
}

func TestNormalizeResolvePaths(t *testing.T) {
	repo := t.TempDir()
	cwd := filepath.Join(repo, "service")
	if err := os.MkdirAll(cwd, 0o750); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	repoRoot, resolvedCwd, targetPath, err := normalizeResolvePaths(ResolveOptions{
		RepoRoot:   repo,
		Cwd:        cwd,
		TargetPath: "file.txt",
	})
	if err != nil {
		t.Fatalf("normalizeResolvePaths: %v", err)
	}
	if repoRoot != repo {
		t.Fatalf("expected repo root %s, got %s", repo, repoRoot)
	}
	if resolvedCwd != cwd {
		t.Fatalf("unexpected cwd %s", resolvedCwd)
	}
	if targetPath != filepath.Join(cwd, "file.txt") {
		t.Fatalf("unexpected target path %s", targetPath)
	}
}

func TestNormalizeResolvePathsMismatch(t *testing.T) {
	repo := t.TempDir()
	other := t.TempDir()
	if err := os.MkdirAll(repo, 0o750); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	_, _, _, err := normalizeResolvePaths(ResolveOptions{
		RepoRoot: repo,
		Cwd:      other,
	})
	if !errors.Is(err, ErrRepoRootMismatch) {
		t.Fatalf("expected mismatch error, got %v", err)
	}
}

func TestParseCodexConfig(t *testing.T) {
	data := []byte(`
project_doc_max_bytes = 123
project_doc_fallback_filenames = ["A.md", "B.md"]
`)
	cfg, err := parseCodexConfig(data)
	if err != nil {
		t.Fatalf("parseCodexConfig: %v", err)
	}
	if cfg.ProjectDocMaxBytes != 123 {
		t.Fatalf("expected max bytes 123, got %d", cfg.ProjectDocMaxBytes)
	}
	if len(cfg.ProjectDocFallbackFilenames) != 2 {
		t.Fatalf("expected 2 fallback filenames")
	}
}

func TestParseCodexConfigInvalid(t *testing.T) {
	data := []byte(`project_doc_max_bytes = "nope"`)
	if _, err := parseCodexConfig(data); err == nil {
		t.Fatalf("expected error for invalid max bytes")
	}
}

func TestParseStringArrayInvalid(t *testing.T) {
	if _, err := parseStringArray("nope"); err == nil {
		t.Fatalf("expected error for invalid array")
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

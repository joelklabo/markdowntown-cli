package instructions

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCodexAdapterResolveOrder(t *testing.T) {
	repo := t.TempDir()
	cwd := filepath.Join(repo, "service")
	if err := os.MkdirAll(cwd, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	codexHome := filepath.Join(t.TempDir(), "codex")
	if err := os.MkdirAll(codexHome, 0o755); err != nil {
		t.Fatalf("mkdir codex home: %v", err)
	}
	t.Setenv("CODEX_HOME", codexHome)

	writeTestFile(t, filepath.Join(codexHome, codexAgentsFilename), "user")
	writeTestFile(t, filepath.Join(codexHome, codexConfigFilename), "project_doc_fallback_filenames = [\"INSTRUCTIONS.md\"]\n")

	writeTestFile(t, filepath.Join(repo, codexAgentsOverrideFilename), "root override")
	writeTestFile(t, filepath.Join(repo, codexAgentsFilename), "root primary")
	writeTestFile(t, filepath.Join(cwd, "INSTRUCTIONS.md"), "service instructions")

	adapter := CodexAdapter{}
	res, err := adapter.Resolve(ResolveOptions{RepoRoot: repo, Cwd: cwd})
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}

	if len(res.Applied) != 3 {
		t.Fatalf("expected 3 instructions, got %d", len(res.Applied))
	}

	if res.OrderGuarantee != OrderDeterministic {
		t.Fatalf("expected deterministic order, got %s", res.OrderGuarantee)
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
	if err := os.MkdirAll(codexHome, 0o755); err != nil {
		t.Fatalf("mkdir codex home: %v", err)
	}
	t.Setenv("CODEX_HOME", codexHome)

	writeTestFile(t, filepath.Join(repo, codexAgentsOverrideFilename), "")
	writeTestFile(t, filepath.Join(repo, codexAgentsFilename), "root primary")

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
	if err := os.MkdirAll(codexHome, 0o755); err != nil {
		t.Fatalf("mkdir codex home: %v", err)
	}
	writeTestFile(t, filepath.Join(codexHome, codexConfigFilename), "project_doc_max_bytes = 5\n")
	writeTestFile(t, filepath.Join(repo, codexAgentsFilename), "1234567890")
	writeTestFile(t, filepath.Join(repo, codexAgentsOverrideFilename), "")

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

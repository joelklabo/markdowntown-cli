package instructions

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCopilotAdapterApplyToAndConflicts(t *testing.T) {
	repo := t.TempDir()
	target := filepath.Join(repo, "pkg", "main.go")
	if err := os.MkdirAll(filepath.Dir(target), 0o750); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(target, []byte("package main"), 0o600); err != nil {
		t.Fatalf("write target: %v", err)
	}

	repoWide := filepath.Join(repo, ".github", "copilot-instructions.md")
	writeCopilotFile(t, repoWide, "repo-wide")

	applyFile := filepath.Join(repo, ".github", "instructions", "go.instructions.md")
	writeCopilotFile(t, applyFile, "---\napplyTo: '**/*.go'\n---\nGo instructions")

	excludeFile := filepath.Join(repo, ".github", "instructions", "exclude.instructions.md")
	writeCopilotFile(t, excludeFile, "---\napplyTo: '**/*.go'\nexcludeAgent: ['coding-agent']\n---\nExcluded")

	adapter := CopilotAdapter{}
	res, err := adapter.Resolve(ResolveOptions{RepoRoot: repo, Cwd: filepath.Dir(target), TargetPath: target})
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}

	if len(res.Applied) != 2 {
		t.Fatalf("expected 2 applied instructions, got %d", len(res.Applied))
	}

	if res.OrderGuarantee != OrderUndefined {
		t.Fatalf("expected undefined order due to conflicts")
	}

	if len(res.Conflicts) == 0 {
		t.Fatalf("expected conflict record")
	}
}

func writeCopilotFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}
}

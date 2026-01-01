package instructions

import (
	"path/filepath"
	"testing"
)

func TestVSCodeAdapterResolveSettingsRequired(t *testing.T) {
	repo := t.TempDir()
	adapter := VSCodeAdapter{}

	res, err := adapter.Resolve(ResolveOptions{RepoRoot: repo, Cwd: repo})
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if len(res.SettingsRequired) != 3 {
		t.Fatalf("expected 3 required settings, got %d", len(res.SettingsRequired))
	}
	if len(res.Applied) != 0 {
		t.Fatalf("expected no applied files")
	}
}

func TestVSCodeAdapterResolveFiles(t *testing.T) {
	repo := t.TempDir()
	writeTestFile(t, filepath.Join(repo, ".github", "copilot-instructions.md"), "root")
	writeTestFile(t, filepath.Join(repo, ".github", "instructions", "foo.instructions.md"), `---
applyTo:
  - "src/**"
---
body`)
	writeTestFile(t, filepath.Join(repo, "AGENTS.md"), "root agent")
	writeTestFile(t, filepath.Join(repo, "sub", "AGENTS.md"), "nested agent")

	settings := map[string]bool{
		vsCodeInstructionSetting: true,
		vsCodeAgentSetting:       true,
		vsCodeNestedAgentSetting: true,
	}

	adapter := VSCodeAdapter{}
	res, err := adapter.Resolve(ResolveOptions{
		RepoRoot:   repo,
		Cwd:        repo,
		TargetPath: filepath.Join(repo, "src", "main.go"),
		Settings:   settings,
	})
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if len(res.SettingsRequired) != 0 {
		t.Fatalf("expected no required settings, got %v", res.SettingsRequired)
	}
	if len(res.Applied) < 3 {
		t.Fatalf("expected applied files, got %d", len(res.Applied))
	}
	if len(res.Conflicts) != 1 {
		t.Fatalf("expected conflict for undefined order")
	}
}

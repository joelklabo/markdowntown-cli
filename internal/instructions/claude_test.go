package instructions

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestClaudeAdapterMemoryPrecedence(t *testing.T) {
	repo := t.TempDir()
	home := t.TempDir()
	setHomeEnv(t, home)

	userClaude := filepath.Join(home, ".claude", claudeFile)
	writeClaudeFile(t, userClaude, "user")

	projectClaude := filepath.Join(repo, claudeFile)
	writeClaudeFile(t, projectClaude, "project")

	subdir := filepath.Join(repo, "service")
	if err := os.MkdirAll(subdir, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	subClaude := filepath.Join(subdir, claudeFile)
	writeClaudeFile(t, subClaude, "sub")

	localClaude := filepath.Join(repo, claudeLocalFile)
	writeClaudeFile(t, localClaude, "local")

	target := filepath.Join(subdir, "main.go")
	writeClaudeFile(t, target, "package main")

	adapter := ClaudeAdapter{}
	res, err := adapter.Resolve(ResolveOptions{RepoRoot: repo, Cwd: subdir, TargetPath: target})
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}

	paths := map[string]struct{}{}
	for _, file := range res.Applied {
		paths[file.Path] = struct{}{}
	}

	expected := []string{userClaude, projectClaude, subClaude, localClaude}
	for _, path := range expected {
		if _, ok := paths[path]; !ok {
			t.Fatalf("expected %s in applied list", path)
		}
	}

	warned := false
	for _, warning := range res.Warnings {
		if strings.Contains(warning, "CLAUDE.local.md") {
			warned = true
			break
		}
	}
	if !warned {
		t.Fatalf("expected CLAUDE.local.md warning")
	}
}

func TestClaudeAdapterImports(t *testing.T) {
	repo := t.TempDir()
	targetDir := filepath.Join(repo, "app")
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	target := filepath.Join(targetDir, "main.go")
	writeClaudeFile(t, target, "package main")

	rulesDir := filepath.Join(repo, ".claude", claudeRulesFolder)
	baseRule := filepath.Join(rulesDir, "base.md")
	childRule := filepath.Join(rulesDir, "child.md")
	grandchildRule := filepath.Join(rulesDir, "grandchild.md")
	skipRule := filepath.Join(repo, "skip.md")

	writeClaudeFile(t, baseRule, "---\npaths: ['**/*.go']\n---\n@import ./child.md\n```\n@import ../skip.md\n```")
	writeClaudeFile(t, childRule, "@import ./grandchild.md\nchild")
	writeClaudeFile(t, grandchildRule, "grandchild")
	writeClaudeFile(t, skipRule, "skip")

	adapter := ClaudeAdapter{MaxImportDepth: 1}
	res, err := adapter.Resolve(ResolveOptions{RepoRoot: repo, Cwd: targetDir, TargetPath: target})
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}

	paths := map[string]struct{}{}
	for _, file := range res.Applied {
		paths[file.Path] = struct{}{}
	}

	if _, ok := paths[baseRule]; !ok {
		t.Fatalf("expected base rule applied")
	}
	if _, ok := paths[childRule]; !ok {
		t.Fatalf("expected child rule applied")
	}

	for _, warning := range res.Warnings {
		if strings.Contains(warning, "outside rules dir") {
			t.Fatalf("unexpected outside rules dir warning: %s", warning)
		}
	}

	foundDepthWarning := false
	for _, warning := range res.Warnings {
		if strings.Contains(warning, "import depth exceeded") {
			foundDepthWarning = true
			break
		}
	}
	if !foundDepthWarning {
		t.Fatalf("expected import depth warning")
	}
}

func setHomeEnv(t *testing.T, home string) {
	t.Helper()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("HOMEPATH", string(os.PathSeparator))
	t.Setenv("HOMEDRIVE", "C:")
}

func writeClaudeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}
}

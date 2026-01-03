package instructions

import (
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestNormalizeStringSlice(t *testing.T) {
	if got := normalizeStringSlice("alpha"); !reflect.DeepEqual(got, []string{"alpha"}) {
		t.Fatalf("unexpected string slice: %#v", got)
	}
	if got := normalizeStringSlice([]string{"a", "b"}); !reflect.DeepEqual(got, []string{"a", "b"}) {
		t.Fatalf("unexpected []string slice: %#v", got)
	}
	if got := normalizeStringSlice([]any{"a", "", 1, nil, "b"}); !reflect.DeepEqual(got, []string{"a", "b"}) {
		t.Fatalf("unexpected []any slice: %#v", got)
	}
	if got := normalizeStringSlice(5); got != nil {
		t.Fatalf("expected nil for unsupported type, got %#v", got)
	}
}

func TestApplyToMatches(t *testing.T) {
	if !applyToMatches([]string{"src/**"}, "src/main.go") {
		t.Fatalf("expected match for src/**")
	}
	if !applyToMatches([]string{"docs/*.md"}, "docs/readme.md") {
		t.Fatalf("expected match for docs/*.md")
	}
	if applyToMatches([]string{"docs/*.md"}, "bin/app") {
		t.Fatalf("did not expect match")
	}
	if applyToMatches([]string{"["}, "docs/readme.md") {
		t.Fatalf("did not expect match for invalid pattern")
	}
}

func TestAgentExcluded(t *testing.T) {
	if !agentExcluded("Codex", []string{"codex"}) {
		t.Fatalf("expected codex excluded")
	}
	if agentExcluded("gemini", []string{"codex"}) {
		t.Fatalf("did not expect gemini excluded")
	}
}

func TestEnsureTargetRel(t *testing.T) {
	repo := t.TempDir()
	target := filepath.Join(repo, "file.txt")
	if err := os.WriteFile(target, []byte("ok"), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}

	rel, err := ensureTargetRel(repo, target)
	if err != nil {
		t.Fatalf("ensureTargetRel: %v", err)
	}
	if rel != "file.txt" {
		t.Fatalf("expected relative path, got %s", rel)
	}

	if _, err := ensureTargetRel(repo, filepath.Join(t.TempDir(), "other.txt")); !errors.Is(err, ErrRepoRootMismatch) {
		t.Fatalf("expected mismatch error, got %v", err)
	}
}

func TestParseInstructionFrontmatter(t *testing.T) {
	path := filepath.Join(t.TempDir(), "rules.instructions.md")
	content := `---
applyTo:
  - "src/**"
excludeAgent:
  - "codex"
---
body`
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}

	applyTo, exclude, err := parseInstructionFrontmatter(path)
	if err != nil {
		t.Fatalf("parseInstructionFrontmatter: %v", err)
	}
	if !reflect.DeepEqual(applyTo, []string{"src/**"}) {
		t.Fatalf("unexpected applyTo: %#v", applyTo)
	}
	if !reflect.DeepEqual(exclude, []string{"codex"}) {
		t.Fatalf("unexpected exclude: %#v", exclude)
	}
}

func TestRequiredSettingEnabled(t *testing.T) {
	if requiredSettingEnabled(nil, "key") {
		t.Fatalf("expected false for nil settings")
	}
	if requiredSettingEnabled(map[string]bool{"key": true}, "key") != true {
		t.Fatalf("expected true for enabled setting")
	}
}

func TestCollectAgentFiles(t *testing.T) {
	repo := t.TempDir()
	if err := os.WriteFile(filepath.Join(repo, "AGENTS.md"), []byte("root"), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(repo, "sub"), 0o750); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(repo, "sub", "AGENTS.md"), []byte("sub"), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}

	files, err := collectAgentFiles(repo)
	if err != nil {
		t.Fatalf("collectAgentFiles: %v", err)
	}
	if len(files) != 2 {
		t.Fatalf("expected 2 files, got %d", len(files))
	}
}

func TestContainsPath(t *testing.T) {
	if !containsPath([]string{"a", "b"}, "b") {
		t.Fatalf("expected to find path")
	}
	if containsPath([]string{"a", "b"}, "c") {
		t.Fatalf("did not expect to find path")
	}
}

func TestUniqueSettings(t *testing.T) {
	settings := uniqueSettings([]string{"a", "", "b", "a"})
	if !reflect.DeepEqual(settings, []string{"a", "b"}) {
		t.Fatalf("unexpected settings: %#v", settings)
	}
}

func TestFormatConflictReason(t *testing.T) {
	if got := formatConflictReason("conflict", nil); got != "conflict" {
		t.Fatalf("unexpected empty reason: %s", got)
	}
	if got := formatConflictReason("conflict", []string{"a", "b"}); got != "conflict: a, b" {
		t.Fatalf("unexpected reason: %s", got)
	}
}

func TestCollectInstructionFiles(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "rules.instructions.md")
	content := `---
applyTo:
  - "src/**"
---
body`
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}

	files, warnings, err := collectInstructionFiles(root, "src/main.go", "")
	if err != nil {
		t.Fatalf("collectInstructionFiles: %v", err)
	}
	if len(warnings) != 0 {
		t.Fatalf("unexpected warnings: %#v", warnings)
	}
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}

	_, warnings, err = collectInstructionFiles(root, "", "")
	if err != nil {
		t.Fatalf("collectInstructionFiles: %v", err)
	}
	if len(warnings) == 0 {
		t.Fatalf("expected warning when target missing")
	}
}

package instructions

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestGeminiAdapterResolve(t *testing.T) {
	repoRoot := t.TempDir()
	initGitRepo(t, repoRoot)

	writeTestFile(t, filepath.Join(repoRoot, "GEMINI.md"), "root")

	subDir := filepath.Join(repoRoot, "sub")
	childDir := filepath.Join(subDir, "child")
	ignoredDir := filepath.Join(subDir, "ignored")
	gignoredDir := filepath.Join(subDir, "gignored")

	if err := os.MkdirAll(childDir, 0o750); err != nil {
		t.Fatalf("mkdir child: %v", err)
	}
	if err := os.MkdirAll(ignoredDir, 0o750); err != nil {
		t.Fatalf("mkdir ignored: %v", err)
	}
	if err := os.MkdirAll(gignoredDir, 0o750); err != nil {
		t.Fatalf("mkdir gignored: %v", err)
	}

	writeTestFile(t, filepath.Join(subDir, "GEMINI.md"), "cwd")
	writeTestFile(t, filepath.Join(childDir, "GEMINI.md"), "child")
	writeTestFile(t, filepath.Join(ignoredDir, "GEMINI.md"), "ignored")
	writeTestFile(t, filepath.Join(gignoredDir, "GEMINI.md"), "gignored")

	writeTestFile(t, filepath.Join(repoRoot, ".gitignore"), "sub/ignored/\n")
	writeTestFile(t, filepath.Join(repoRoot, ".geminiignore"), "sub/gignored/\n")

	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	if err := os.MkdirAll(filepath.Join(home, ".gemini"), 0o750); err != nil {
		t.Fatalf("mkdir gemini home: %v", err)
	}
	writeTestFile(t, filepath.Join(home, ".gemini", "GEMINI.md"), "global")

	adapter := GeminiAdapter{}
	res, err := adapter.Resolve(ResolveOptions{RepoRoot: repoRoot, Cwd: subDir})
	if err != nil {
		t.Fatalf("resolve failed: %v", err)
	}

	if res.OrderGuarantee != OrderDeterministic {
		t.Fatalf("expected deterministic order, got %s", res.OrderGuarantee)
	}

	var paths []string
	for _, file := range res.Applied {
		paths = append(paths, file.Path)
	}

	expected := []string{
		filepath.Join(home, ".gemini", "GEMINI.md"),
		filepath.Join(repoRoot, "GEMINI.md"),
		filepath.Join(subDir, "GEMINI.md"),
		filepath.Join(childDir, "GEMINI.md"),
	}

	if len(paths) != len(expected) {
		t.Fatalf("expected %d files, got %d", len(expected), len(paths))
	}
	for i, path := range expected {
		if paths[i] != path {
			t.Fatalf("expected %s at %d, got %s", path, i, paths[i])
		}
	}
}

func TestGeminiAdapterCustomFilenames(t *testing.T) {
	repoRoot := t.TempDir()
	initGitRepo(t, repoRoot)

	writeTestFile(t, filepath.Join(repoRoot, "CUSTOM.md"), "custom")
	writeTestFile(t, filepath.Join(repoRoot, "GEMINI.md"), "default")

	adapter := GeminiAdapter{Filenames: []string{"CUSTOM.md"}}
	res, err := adapter.Resolve(ResolveOptions{RepoRoot: repoRoot, Cwd: repoRoot})
	if err != nil {
		t.Fatalf("resolve failed: %v", err)
	}
	if len(res.Applied) != 1 {
		t.Fatalf("expected 1 applied file, got %d", len(res.Applied))
	}
	if res.Applied[0].Path != filepath.Join(repoRoot, "CUSTOM.md") {
		t.Fatalf("expected CUSTOM.md, got %s", res.Applied[0].Path)
	}
}

func TestGeminiIgnoreMatch(t *testing.T) {
	patterns := []string{
		"docs/",
		"*.md",
		"notes.txt",
	}

	if !geminiIgnoreMatch("docs/readme.md", patterns) {
		t.Fatalf("expected directory prefix match")
	}
	if !geminiIgnoreMatch("file.md", patterns) {
		t.Fatalf("expected glob match")
	}
	if !geminiIgnoreMatch("notes.txt", patterns) {
		t.Fatalf("expected exact match")
	}
	if geminiIgnoreMatch("file.txt", patterns) {
		t.Fatalf("did not expect match")
	}
}

func initGitRepo(t *testing.T, dir string) {
	t.Helper()
	cmd := exec.Command("git", "init")
	cmd.Dir = dir
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git init failed: %v: %s", err, string(output))
	}
}

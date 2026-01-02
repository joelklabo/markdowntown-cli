package main

import (
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"markdowntown-cli/internal/scan"
)

func TestScanCLIForFile(t *testing.T) {
	root := repoRoot(t)
	repo := t.TempDir()

	// Init git repo
	cmd := exec.Command("git", "init")
	cmd.Dir = repo
	if err := cmd.Run(); err != nil {
		t.Fatalf("git init: %v", err)
	}

	// Create directories
	if err := os.MkdirAll(filepath.Join(repo, "src"), 0o750); err != nil {
		t.Fatal(err)
	}

	// Create GEMINI.md files (nearest-ancestor)
	if err := os.WriteFile(filepath.Join(repo, "GEMINI.md"), []byte("root"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(repo, "src", "GEMINI.md"), []byte("src"), 0o600); err != nil {
		t.Fatal(err)
	}

	// Set registry
	t.Setenv("MARKDOWNTOWN_REGISTRY", filepath.Join(root, "data", "ai-config-patterns.json"))

	// Capture output
	stdoutReader, stdoutWriter, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe stdout: %v", err)
	}
	oldStdout := os.Stdout
	os.Stdout = stdoutWriter
	defer func() {
		os.Stdout = oldStdout
	}()

	// Target file: src/main.ts
	target := filepath.Join(repo, "src", "main.ts")
	if err := os.WriteFile(target, []byte(""), 0o600); err != nil {
		t.Fatal(err)
	}

	// Run scan
	err = runScan([]string{"--repo", repo, "--repo-only", "--for-file", target, "--compact", "--no-content"})
	_ = stdoutWriter.Close()
	if err != nil {
		t.Fatalf("runScan error: %v", err)
	}

	outBytes, err := io.ReadAll(stdoutReader)
	if err != nil {
		t.Fatalf("read stdout: %v", err)
	}
	var output scan.Output
	if err := json.Unmarshal(outBytes, &output); err != nil {
		t.Fatalf("unmarshal output: %v", err)
	}

	// Check results
	foundSrc := false
	foundRoot := false
	t.Logf("Configs found: %d", len(output.Configs))
	for _, entry := range output.Configs {
		t.Logf("Path: %s", entry.Path)
		if strings.HasSuffix(entry.Path, "GEMINI.md") {
			// Check which one
			// Since we run from temp repo, check suffix
			if strings.HasSuffix(entry.Path, filepath.Join("src", "GEMINI.md")) {
				foundSrc = true
			} else if filepath.Base(entry.Path) == "GEMINI.md" && !strings.Contains(entry.Path, "src") {
				foundRoot = true
			}
		}
	}

	if !foundSrc {
		t.Error("Expected src/GEMINI.md to be present (nearest ancestor)")
	}
	if foundRoot {
		t.Error("Expected root GEMINI.md to be filtered out (nearest ancestor)")
	}
}

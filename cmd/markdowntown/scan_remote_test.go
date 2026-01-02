package main

import (
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"markdowntown-cli/internal/scan"
)

func TestScanRemoteCLI(t *testing.T) {
	// Setup a "remote" repo
	originDir, err := os.MkdirTemp("", "test-origin-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = os.RemoveAll(originDir)
	})

	runGit(t, originDir, "init")
	runGit(t, originDir, "config", "user.email", "you@example.com")
	runGit(t, originDir, "config", "user.name", "Your Name")
	runGit(t, originDir, "checkout", "-b", "main")

	if err := os.WriteFile(filepath.Join(originDir, "GEMINI.md"), []byte("# Hello"), 0600); err != nil {
		t.Fatal(err)
	}
	runGit(t, originDir, "add", ".")
	runGit(t, originDir, "commit", "-m", "Initial commit")

	// Setup registry env var
	root := repoRoot(t)
	t.Setenv("MARKDOWNTOWN_REGISTRY", filepath.Join(root, "data", "ai-config-patterns.json"))

	// Capture stdout
	stdoutReader, stdoutWriter, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe stdout: %v", err)
	}
	oldStdout := os.Stdout
	os.Stdout = stdoutWriter
	defer func() {
		os.Stdout = oldStdout
	}()

	// Run command
	// We call runScanRemote directly which is in main package
	err = runScanRemote([]string{"--repo-only", "--compact", "--no-content", originDir})
	_ = stdoutWriter.Close()
	if err != nil {
		t.Fatalf("runScanRemote error: %v", err)
	}

	outBytes, err := io.ReadAll(stdoutReader)
	if err != nil {
		t.Fatalf("read stdout: %v", err)
	}
	var output scan.Output
	if err := json.Unmarshal(outBytes, &output); err != nil {
		t.Fatalf("unmarshal output: %v\nOutput: %s", err, string(outBytes))
	}

	// Verify
	if output.RepoRoot == "" {
		t.Error("RepoRoot should be set")
	}
	// Verify file found
	found := false
	for _, entry := range output.Configs {
		// Path will be absolute path in temp dir.
		if filepath.Base(entry.Path) == "GEMINI.md" {
			found = true
			break
		}
	}
	if !found {
		t.Error("GEMINI.md not found in scan output")
	}
}

func runGit(t *testing.T, dir string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %v failed: %v\nOutput: %s", args, err, out)
	}
}

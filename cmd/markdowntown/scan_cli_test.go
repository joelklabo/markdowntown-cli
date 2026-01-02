package main

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"markdowntown-cli/internal/scan"
	"markdowntown-cli/internal/version"
)

func TestScanCLISchemaVersion(t *testing.T) {
	root := repoRoot(t)
	repo := t.TempDir()
	cmd := exec.Command("git", "init")
	cmd.Dir = repo
	if err := cmd.Run(); err != nil {
		t.Fatalf("git init: %v", err)
	}
	if err := os.WriteFile(filepath.Join(repo, "README.md"), []byte("ok"), 0o600); err != nil {
		t.Fatalf("write repo file: %v", err)
	}

	t.Setenv("MARKDOWNTOWN_REGISTRY", filepath.Join(root, "data", "ai-config-patterns.json"))

	stdoutReader, stdoutWriter, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe stdout: %v", err)
	}
	oldStdout := os.Stdout
	os.Stdout = stdoutWriter
	defer func() {
		os.Stdout = oldStdout
	}()

	err = runScan([]string{"--repo", repo, "--repo-only", "--compact", "--no-content"})
	_ = stdoutWriter.Close()
	if err != nil {
		t.Fatalf("runScan error: %v", err)
	}

	outBytes, err := io.ReadAll(stdoutReader)
	if err != nil {
		t.Fatalf("read stdout: %v", err)
	}
	var output scan.Output
	if err := json.Unmarshal(bytes.TrimSpace(outBytes), &output); err != nil {
		t.Fatalf("unmarshal output: %v", err)
	}
	if output.SchemaVersion != version.SchemaVersion {
		t.Fatalf("expected schemaVersion %s, got %s", version.SchemaVersion, output.SchemaVersion)
	}
}

func TestScanCLIJSONLOutput(t *testing.T) {
	root := repoRoot(t)
	repo := t.TempDir()
	cmd := exec.Command("git", "init")
	cmd.Dir = repo
	if err := cmd.Run(); err != nil {
		t.Fatalf("git init: %v", err)
	}
	if err := os.WriteFile(filepath.Join(repo, "README.md"), []byte("ok"), 0o600); err != nil {
		t.Fatalf("write repo file: %v", err)
	}

	t.Setenv("MARKDOWNTOWN_REGISTRY", filepath.Join(root, "data", "ai-config-patterns.json"))

	stdoutReader, stdoutWriter, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe stdout: %v", err)
	}
	oldStdout := os.Stdout
	os.Stdout = stdoutWriter
	defer func() {
		os.Stdout = oldStdout
	}()

	err = runScan([]string{"--repo", repo, "--repo-only", "--no-content", "--format", "jsonl"})
	_ = stdoutWriter.Close()
	if err != nil {
		t.Fatalf("runScan error: %v", err)
	}

	outBytes, err := io.ReadAll(stdoutReader)
	if err != nil {
		t.Fatalf("read stdout: %v", err)
	}
	lines := bytes.Split(bytes.TrimSpace(outBytes), []byte("\n"))
	if len(lines) != 1 {
		t.Fatalf("expected JSONL output to be single line, got %d lines", len(lines))
	}

	var output scan.Output
	if err := json.Unmarshal(lines[0], &output); err != nil {
		t.Fatalf("unmarshal JSONL output: %v", err)
	}
	if output.SchemaVersion != version.SchemaVersion {
		t.Fatalf("expected schemaVersion %s, got %s", version.SchemaVersion, output.SchemaVersion)
	}
}

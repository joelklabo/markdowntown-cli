package main

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"markdowntown-cli/internal/audit"
	"markdowntown-cli/internal/scan"
	"markdowntown-cli/internal/version"
)

func TestAuditCLI(t *testing.T) {
	root := repoRoot(t)
	t.Setenv("MARKDOWNTOWN_REGISTRY", filepath.Join(root, "data", "ai-config-patterns.json"))

	input := scan.Output{
		SchemaVersion:   version.SchemaVersion,
		RegistryVersion: "1.0",
		ToolVersion:     "0.1.0",
		ScanStartedAt:   1,
		GeneratedAt:     2,
		RepoRoot:        "/repo",
		Scans:           []scan.Root{{Scope: "repo", Root: "/repo", Exists: true}},
		Configs:         nil,
		Warnings:        nil,
	}
	payload, err := json.Marshal(input)
	if err != nil {
		t.Fatalf("marshal input: %v", err)
	}

	stdinReader, stdinWriter, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe stdin: %v", err)
	}
	stdoutReader, stdoutWriter, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe stdout: %v", err)
	}

	oldStdin := os.Stdin
	oldStdout := os.Stdout
	os.Stdin = stdinReader
	os.Stdout = stdoutWriter
	defer func() {
		os.Stdin = oldStdin
		os.Stdout = oldStdout
	}()

	go func() {
		_, _ = stdinWriter.Write(payload)
		_ = stdinWriter.Close()
	}()

	err = runAudit([]string{"--input", "-", "--format", "json", "--compact"})
	_ = stdoutWriter.Close()
	if err != nil {
		t.Fatalf("runAudit error: %v", err)
	}

	outBytes, err := io.ReadAll(stdoutReader)
	if err != nil {
		t.Fatalf("read stdout: %v", err)
	}
	output := strings.TrimSpace(string(outBytes))
	if output == "" {
		t.Fatalf("expected output")
	}
	if !strings.Contains(output, "\"issues\":[") {
		t.Fatalf("expected issues array in output, got %s", output)
	}

	var parsed audit.Output
	if err := json.Unmarshal(outBytes, &parsed); err != nil {
		t.Fatalf("unmarshal output: %v", err)
	}
	if parsed.SchemaVersion != version.AuditSchemaVersion {
		t.Fatalf("expected schemaVersion %s, got %s", version.AuditSchemaVersion, parsed.SchemaVersion)
	}

	if !bytes.HasSuffix(outBytes, []byte("\n")) {
		t.Fatalf("expected trailing newline in output")
	}
}
